"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export interface OnboardingFormState {
  error?: string;
}

const cashBoxSchema = z.object({
  name: z.string().trim().min(1),
  openingBalance: z.coerce.number().min(0).default(0),
});

/**
 * Second step: the cash box the money moves through.
 *
 * Without one, a loan cannot be disbursed and a payment has nowhere to land,
 * so it is part of the setup rather than something to discover later.
 */
export async function createFirstCashBox(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const context = await requirePermission("cash.create");
  const parsed = cashBoxSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const existing = await db.cashBox.findFirst({
    where: { companyId: context.companyId },
    select: { id: true },
  });

  // Re-running the step should not leave two boxes behind.
  if (existing) {
    await db.cashBox.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        balance: parsed.data.openingBalance,
      },
    });
  } else {
    await db.cashBox.create({
      data: {
        companyId: context.companyId,
        name: parsed.data.name,
        kind: "CASH",
        balance: parsed.data.openingBalance,
      },
    });
  }

  revalidatePath("/bienvenida");
  redirect("/bienvenida?paso=3");
}

/** Last step: mark the setup done so the wizard stops showing itself. */
export async function finishOnboarding(): Promise<void> {
  const context = await requirePermission("settings.update");

  await db.company.update({
    where: { id: context.companyId },
    data: { setupCompletedAt: new Date() },
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
