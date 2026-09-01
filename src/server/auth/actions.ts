"use server";

/**
 * Authentication server actions.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";

import { db } from "../db";
import { verifyPassword } from "./password";
import {
  clearSessionCookie,
  generateSessionToken,
  hashSessionToken,
  readSessionToken,
  sessionExpiry,
  setSessionCookie,
} from "./session";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface ActionState {
  error?: string;
}

export async function signIn(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: t("auth.invalidCredentials") };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { where: { isActive: true }, take: 1 } },
  });

  // Compare against a dummy hash when the user is missing so that a wrong
  // email and a wrong password take the same amount of time.
  const passwordHash =
    user?.passwordHash ??
    "$2a$12$0000000000000000000000000000000000000000000000000000";
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    passwordHash,
  );

  if (!user || !passwordMatches) {
    return { error: t("auth.invalidCredentials") };
  }
  if (!user.isActive) {
    return { error: t("auth.accountDisabled") };
  }
  if (user.memberships.length === 0) {
    return { error: t("auth.noCompany") };
  }

  const token = generateSessionToken();
  const headerList = await headers();

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
      ipAddress:
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      expiresAt: sessionExpiry(),
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await setSessionCookie(token);
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await db.session
      .updateMany({
        where: { tokenHash: hashSessionToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  await clearSessionCookie();
  redirect("/login");
}
