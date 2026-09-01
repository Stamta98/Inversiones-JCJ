/**
 * User service.
 *
 * Creating staff, changing roles and rotating passwords. Everything here is
 * scoped to a company: a manager can only ever touch people who belong to
 * their own company.
 */

import { db } from "../db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "../auth/password";
import { hashSessionToken } from "../auth/session";

export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "emailTaken"
      | "weakPassword"
      | "wrongPassword"
      | "notFound"
      | "lastOwner",
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

export interface CreateUserInput {
  companyId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  password: string;
  roleId: string;
  branchId?: string | null;
  createdById?: string | null;
}

export async function createCompanyUser(
  input: CreateUserInput,
): Promise<string> {
  const email = input.email.trim().toLowerCase();

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new UserServiceError("Password too short", "weakPassword");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // An account can only belong to one company in this model, so an email
    // already in use is a conflict rather than something to join.
    throw new UserServiceError("Email already in use", "emailTaken");
  }

  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    const role = await tx.role.findFirst({
      where: { id: input.roleId, companyId: input.companyId },
    });
    if (!role) throw new UserServiceError("Role not found", "notFound");

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        phone: input.phone ?? null,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        companyId: input.companyId,
        roleId: role.id,
        branchId: input.branchId ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.createdById ?? null,
        action: "user.created",
        entityType: "User",
        entityId: user.id,
        metadata: { email, role: role.key },
      },
    });

    return user.id;
  });
}

/** Counts the active owners, so the last one cannot lock everyone out. */
async function activeOwnerCount(companyId: string): Promise<number> {
  return db.membership.count({
    where: {
      companyId,
      isActive: true,
      user: { isActive: true },
      role: { key: "owner" },
    },
  });
}

export interface UpdateUserInput {
  companyId: string;
  userId: string;
  fullName?: string;
  phone?: string | null;
  roleId?: string;
  isActive?: boolean;
  updatedById?: string | null;
}

export async function updateCompanyUser(input: UpdateUserInput): Promise<void> {
  const membership = await db.membership.findFirst({
    where: { userId: input.userId, companyId: input.companyId },
    include: { role: true, user: true },
  });
  if (!membership) throw new UserServiceError("User not found", "notFound");

  const wasOwner = membership.role.key === "owner";
  const losesOwnership =
    (input.isActive === false && wasOwner) ||
    (input.roleId !== undefined && input.roleId !== membership.roleId && wasOwner);

  if (losesOwnership && (await activeOwnerCount(input.companyId)) <= 1) {
    // Without an owner nobody can manage users or modules ever again.
    throw new UserServiceError("Cannot remove the last owner", "lastOwner");
  }

  await db.$transaction(async (tx) => {
    if (input.fullName !== undefined || input.phone !== undefined || input.isActive !== undefined) {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          ...(input.fullName !== undefined
            ? { fullName: input.fullName.trim() }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    }

    if (input.roleId !== undefined) {
      const role = await tx.role.findFirst({
        where: { id: input.roleId, companyId: input.companyId },
      });
      if (!role) throw new UserServiceError("Role not found", "notFound");
      await tx.membership.update({
        where: { id: membership.id },
        data: { roleId: role.id },
      });
    }

    // A deactivated user must not keep browsing on an open session.
    if (input.isActive === false) {
      await tx.session.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.updatedById ?? null,
        action: "user.updated",
        entityType: "User",
        entityId: input.userId,
        metadata: {
          isActive: input.isActive ?? null,
          roleChanged: input.roleId !== undefined,
        },
      },
    });
  });
}

/**
 * Changes your own password. Requires the current one, so a forgotten open
 * session cannot be used to take the account over.
 */
export async function changeOwnPassword(input: {
  userId: string;
  companyId: string;
  currentPassword: string;
  newPassword: string;
  /** Session to keep alive; every other one is revoked. */
  keepSessionToken?: string | null;
}): Promise<void> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new UserServiceError("Password too short", "weakPassword");
  }

  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new UserServiceError("User not found", "notFound");

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw new UserServiceError("Current password is wrong", "wrongPassword");
  }

  const passwordHash = await hashPassword(input.newPassword);
  const keepHash = input.keepSessionToken
    ? hashSessionToken(input.keepSessionToken)
    : null;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash },
    });

    // Changing a password signs out anywhere else it was used.
    await tx.session.updateMany({
      where: {
        userId: input.userId,
        revokedAt: null,
        ...(keepHash ? { tokenHash: { not: keepHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "user.passwordChanged",
        entityType: "User",
        entityId: input.userId,
        metadata: {},
      },
    });
  });
}

/** An administrator setting a new password for someone else. */
export async function resetUserPassword(input: {
  companyId: string;
  userId: string;
  newPassword: string;
  resetById?: string | null;
}): Promise<void> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new UserServiceError("Password too short", "weakPassword");
  }

  const membership = await db.membership.findFirst({
    where: { userId: input.userId, companyId: input.companyId },
  });
  if (!membership) throw new UserServiceError("User not found", "notFound");

  const passwordHash = await hashPassword(input.newPassword);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash },
    });
    await tx.session.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.resetById ?? null,
        action: "user.passwordReset",
        entityType: "User",
        entityId: input.userId,
        metadata: {},
      },
    });
  });
}
