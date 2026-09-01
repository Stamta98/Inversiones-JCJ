"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

const interactionSchema = z.object({
  customerId: z.string().min(1),
  loanId: z.string().optional(),
  channel: z.enum(["CALL", "WHATSAPP", "SMS", "EMAIL", "VISIT", "NOTE"]),
  outcome: z.enum([
    "PENDING",
    "CONTACTED",
    "NO_ANSWER",
    "WRONG_NUMBER",
    "PAYMENT_PROMISED",
    "PAYMENT_MADE",
    "REFUSED",
    "DISPUTE",
    "CALLBACK_REQUESTED",
  ]),
  notes: z.string().optional(),
  promisedAmount: z.string().optional(),
  promisedFor: z.string().optional(),
  followUpAt: z.string().optional(),
});

export interface InteractionFormState {
  error?: string;
  success?: string;
}

function optionalDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function logInteraction(
  _previous: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const context = await requirePermission("callCenter.create");

  const parsed = interactionSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;
  const promisedAmount = data.promisedAmount
    ? Number(data.promisedAmount)
    : null;

  await db.interaction.create({
    data: {
      companyId: context.companyId,
      customerId: data.customerId,
      loanId: data.loanId || null,
      agentId: context.userId,
      channel: data.channel,
      outcome: data.outcome,
      notes: data.notes || null,
      promisedAmount:
        promisedAmount !== null && Number.isFinite(promisedAmount)
          ? promisedAmount
          : null,
      promisedFor: optionalDate(data.promisedFor),
      followUpAt: optionalDate(data.followUpAt),
    },
  });

  revalidatePath("/call-center");
  return { success: t("common.save") };
}
