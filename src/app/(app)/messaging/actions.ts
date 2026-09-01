"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { t } from "@/i18n";
import { PROVIDER_KEYS } from "@/modules/messaging/providers";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { dispatchQueue, queueScheduledMessages } from "@/server/services/messaging";

const accountSchema = z.object({
  displayName: z.string().trim().min(1),
  provider: z.enum(PROVIDER_KEYS),
  phoneNumber: z.string().trim().optional(),
  accessToken: z.string().trim().optional(),
  phoneNumberId: z.string().trim().optional(),
  baseUrl: z.string().trim().optional(),
  token: z.string().trim().optional(),
});

const ruleSchema = z.object({
  name: z.string().trim().min(1),
  trigger: z.enum([
    "BEFORE_DUE_DATE",
    "ON_DUE_DATE",
    "AFTER_DUE_DATE",
    "ARREARS_THRESHOLD",
    "ON_PAYMENT_POSTED",
    "ON_LOAN_DISBURSED",
  ]),
  offsetDays: z.coerce.number().int().min(0).default(0),
  templateId: z.string().min(1),
  sendAtTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
});

export interface MessagingFormState {
  error?: string;
  success?: string;
}

/** Only the fields the chosen provider actually needs are stored. */
function credentialsFor(
  provider: string,
  data: z.infer<typeof accountSchema>,
): Record<string, string> {
  if (provider === "cloud_api") {
    return {
      accessToken: data.accessToken ?? "",
      phoneNumberId: data.phoneNumberId ?? "",
    };
  }
  if (provider === "bridge") {
    return { baseUrl: data.baseUrl ?? "", token: data.token ?? "" };
  }
  return {};
}

export async function saveMessagingAccount(
  _previous: MessagingFormState,
  formData: FormData,
): Promise<MessagingFormState> {
  const context = await requirePermission("messaging.create");
  const parsed = accountSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const existing = await db.messagingAccount.count({
    where: { companyId: context.companyId },
  });

  await db.messagingAccount.create({
    data: {
      companyId: context.companyId,
      channel: "WHATSAPP",
      provider: parsed.data.provider,
      displayName: parsed.data.displayName,
      phoneNumber: parsed.data.phoneNumber || null,
      credentials: credentialsFor(parsed.data.provider, parsed.data),
      isDefault: existing === 0,
    },
  });

  revalidatePath("/messaging");
  return { success: t("common.save") };
}

export async function saveAutomationRule(
  _previous: MessagingFormState,
  formData: FormData,
): Promise<MessagingFormState> {
  const context = await requirePermission("messaging.create");
  const parsed = ruleSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  await db.automationRule.create({
    data: {
      companyId: context.companyId,
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      offsetDays: parsed.data.offsetDays,
      channel: "WHATSAPP",
      templateId: parsed.data.templateId,
      sendAtTime: parsed.data.sendAtTime,
    },
  });

  revalidatePath("/messaging");
  return { success: t("common.save") };
}

export async function toggleAutomationRule(formData: FormData): Promise<void> {
  const context = await requirePermission("messaging.update");
  const id = String(formData.get("id") ?? "");

  const rule = await db.automationRule.findFirst({
    where: { id, companyId: context.companyId },
  });
  if (!rule) return;

  await db.automationRule.update({
    where: { id },
    data: { isActive: !rule.isActive },
  });

  revalidatePath("/messaging");
}

/** Runs the whole pipeline now instead of waiting for the scheduler. */
export async function runMessagingNow(): Promise<void> {
  const context = await requirePermission("messaging.create");

  await queueScheduledMessages(context.companyId);
  await dispatchQueue(context.companyId);

  revalidatePath("/messaging");
}
