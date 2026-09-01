"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import {
  PaymentError,
  postPayment,
  reversePayment,
  type PaymentMethod,
} from "@/server/services/payments";

const paymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z
    .enum(["CASH", "BANK_TRANSFER", "CARD", "CHECK", "MOBILE_WALLET", "OTHER"])
    .default("CASH"),
  paidAt: z.string().optional(),
  cashBoxId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export interface PaymentFormState {
  error?: string;
  success?: string;
}

export async function postPaymentAction(
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const context = await requirePermission("payments.create");

  const parsed = paymentSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) {
    return { error: t("payments.errors.amountPositive") };
  }

  const data = parsed.data;

  try {
    const result = await postPayment({
      companyId: context.companyId,
      loanId: data.loanId,
      amount: data.amount,
      method: data.method as PaymentMethod,
      paidAt: data.paidAt ? new Date(`${data.paidAt}T12:00:00.000Z`) : undefined,
      cashBoxId: data.cashBoxId || null,
      reference: data.reference || null,
      notes: data.notes || null,
      collectedById: context.userId,
    });

    revalidatePath(`/loans/${data.loanId}`);
    revalidatePath("/payments");
    revalidatePath("/dashboard");

    return {
      success: `${t("payments.receipt")} ${result.receiptNumber}`,
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { error: t(`payments.errors.${error.code}`) };
    }
    throw error;
  }
}

export async function reversePaymentAction(formData: FormData): Promise<void> {
  const context = await requirePermission("payments.delete");
  const paymentId = String(formData.get("paymentId") ?? "");
  const reason = String(formData.get("reason") ?? "") || undefined;

  await reversePayment(paymentId, { reason, userId: context.userId });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
}
