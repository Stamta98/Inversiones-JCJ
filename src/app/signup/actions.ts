"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { db } from "@/server/db";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
  setSessionCookie,
} from "@/server/auth/session";
import { SignUpError, signUpCompany } from "@/server/services/onboarding";

export interface SignUpFormState {
  error?: string;
}

const schema = z
  .object({
    companyName: z.string().trim().min(1),
    countryCode: z.string().trim().length(2),
    ownerFullName: z.string().trim().min(1),
    ownerEmail: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
    passwordRepeat: z.string().min(1),
  })
  .refine((data) => data.password === data.passwordRepeat, {
    path: ["passwordRepeat"],
    message: "mismatch",
  });

export async function signUpAction(
  _previous: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const parsed = schema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "mismatch") {
      return { error: t("signUp.errors.passwordMismatch") };
    }
    if (issue?.path[0] === "ownerEmail") return { error: t("validation.email") };
    if (issue?.path[0] === "countryCode") {
      return { error: t("signUp.errors.unknownCountry") };
    }
    return { error: t("common.error") };
  }

  const data = parsed.data;
  let result;

  try {
    result = await signUpCompany({
      companyName: data.companyName,
      countryCode: data.countryCode,
      ownerFullName: data.ownerFullName,
      ownerEmail: data.ownerEmail,
      password: data.password,
    });
  } catch (error) {
    if (error instanceof SignUpError) {
      return { error: t(`signUp.errors.${error.code}`) };
    }
    throw error;
  }

  // Signed in straight away: asking someone to type the password they just
  // chose, on the next screen, is friction with nothing behind it.
  const token = generateSessionToken();
  const headerList = await headers();

  await db.session.create({
    data: {
      userId: result.userId,
      tokenHash: hashSessionToken(token),
      userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
      ipAddress:
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      expiresAt: sessionExpiry(),
    },
  });
  await db.user.update({
    where: { id: result.userId },
    data: { lastLoginAt: new Date() },
  });
  await setSessionCookie(token);

  redirect("/bienvenida");
}
