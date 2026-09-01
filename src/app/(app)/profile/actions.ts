"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { t } from "@/i18n";
import { requireAuth } from "@/server/auth/context";
import { readSessionToken } from "@/server/auth/session";
import { UserServiceError, changeOwnPassword } from "@/server/services/users";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
    repeatPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.repeatPassword, {
    message: "mismatch",
  });

export async function changePasswordAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const context = await requireAuth();

  const parsed = schema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) {
    return { error: t("settings.userErrors.passwordMismatch") };
  }

  try {
    await changeOwnPassword({
      userId: context.userId,
      companyId: context.companyId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      // The session doing the change stays alive; the rest are revoked.
      keepSessionToken: await readSessionToken(),
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return { error: t(`settings.userErrors.${error.code}`) };
    }
    throw error;
  }

  revalidatePath("/profile");
  return { success: t("profile.passwordChanged") };
}
