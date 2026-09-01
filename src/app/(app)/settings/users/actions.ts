"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import {
  UserServiceError,
  createCompanyUser,
  resetUserPassword,
  updateCompanyUser,
} from "@/server/services/users";

export interface UserFormState {
  error?: string;
  success?: string;
}

const createSchema = z
  .object({
    fullName: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(),
    phone: z
      .string()
      .trim()
      .optional()
      .transform((value) =>
        value === undefined || value.length === 0 ? null : value,
      ),
    roleId: z.string().min(1),
    password: z.string().min(1),
    passwordRepeat: z.string().min(1),
  })
  .refine((data) => data.password === data.passwordRepeat, {
    path: ["passwordRepeat"],
    message: "mismatch",
  });

function messageFor(error: unknown): string {
  if (error instanceof UserServiceError) {
    return t(`settings.userErrors.${error.code}`);
  }
  throw error;
}

function readForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

export async function createUserAction(
  _previous: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const context = await requirePermission("users.create");
  const parsed = createSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "mismatch") {
      return { error: t("settings.userErrors.passwordMismatch") };
    }
    if (issue?.path[0] === "email") return { error: t("validation.email") };
    return { error: t("common.error") };
  }

  try {
    await createCompanyUser({
      companyId: context.companyId,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      password: parsed.data.password,
      roleId: parsed.data.roleId,
      createdById: context.userId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/settings");
  redirect("/settings");
}

const updateSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().trim().min(1),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value === undefined || value.length === 0 ? null : value,
    ),
  roleId: z.string().min(1),
  isActive: z.string().optional(),
});

export async function updateUserAction(
  _previous: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const context = await requirePermission("users.update");
  const parsed = updateSchema.safeParse(readForm(formData));

  if (!parsed.success) return { error: t("common.error") };

  try {
    await updateCompanyUser({
      companyId: context.companyId,
      userId: parsed.data.userId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      roleId: parsed.data.roleId,
      isActive: parsed.data.isActive === "on",
      updatedById: context.userId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/settings");
  return { success: t("customers.saved") };
}

const resetSchema = z
  .object({
    userId: z.string().min(1),
    password: z.string().min(1),
    passwordRepeat: z.string().min(1),
  })
  .refine((data) => data.password === data.passwordRepeat, {
    message: "mismatch",
  });

export async function resetPasswordAction(
  _previous: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const context = await requirePermission("users.update");
  const parsed = resetSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return { error: t("settings.userErrors.passwordMismatch") };
  }

  try {
    await resetUserPassword({
      companyId: context.companyId,
      userId: parsed.data.userId,
      newPassword: parsed.data.password,
      resetById: context.userId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/settings");
  return { success: t("settings.resetPasswordDone") };
}
