"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import {
  PaymentError,
  collectCharge,
  deletePayment,
  postPayment,
  reversePayment,
  updatePayment,
  type PaymentMethod,
} from "@/server/services/payments";

const paymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.coerce.number().positive(),
  /**
   * Qué se está cobrando. Un cargo adicional entra a la caja pero no es un
   * abono: no se reparte entre las cuotas ni baja lo que el cliente debe.
   */
  concept: z
    .enum(["INSTALLMENT", "LATE_FEE", "CHARGE"])
    .default("INSTALLMENT"),
  chargeName: z.string().optional(),
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
    // El cargo que se cobra aparte no pasa por el reparto entre cuotas: se
    // registra como lo que es, plata que entró por un cargo.
    if (data.concept === "CHARGE") {
      const charge = await collectCharge({
        companyId: context.companyId,
        loanId: data.loanId,
        name: data.chargeName ?? "",
        amount: data.amount,
        cashBoxId: data.cashBoxId || "",
        collectedAt: data.paidAt
          ? new Date(`${data.paidAt}T12:00:00.000Z`)
          : undefined,
        collectedById: context.userId,
      });

      revalidatePath(`/loans/${data.loanId}`);
      revalidatePath("/payments");
      revalidatePath("/cash");
      revalidatePath("/dashboard");

      return {
        success: t("payments.chargeCollected").replace("{name}", charge.name),
      };
    }

    const result = await postPayment({
      companyId: context.companyId,
      loanId: data.loanId,
      amount: data.amount,
      // Cobrar solo la mora es un abono como cualquier otro: lleva su recibo
      // y entra a la caja. Lo único distinto es hasta dónde llega la plata.
      scope: data.concept === "LATE_FEE" ? "LATE_FEE" : "ALL",
      method: data.method as PaymentMethod,
      paidAt: data.paidAt
        ? new Date(`${data.paidAt}T12:00:00.000Z`)
        : undefined,
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

  // El id llega del formulario: hay que confirmar que el cobro es de esta
  // empresa antes de tocarlo.
  const payment = await db.payment.findFirst({
    where: { id: paymentId, loan: { companyId: context.companyId } },
    select: { id: true, loanId: true },
  });
  if (!payment) return;

  await reversePayment(payment.id, { reason, userId: context.userId });

  revalidatePath(`/loans/${payment.loanId}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

/**
 * Borra un cobro.
 *
 * Anular deja el recibo marcado y a la vista, que es lo correcto casi siempre.
 * Esto es para el cobro que nunca debió existir — el monto mal tecleado, el
 * cliente equivocado — y por eso deja rastro en la auditoría.
 */
export async function deletePaymentAction(formData: FormData): Promise<void> {
  const context = await requirePermission("payments.delete");
  const paymentId = String(formData.get("paymentId") ?? "");

  const payment = await db.payment.findFirst({
    where: { id: paymentId, companyId: context.companyId },
    select: { id: true, loanId: true },
  });
  if (!payment) return;

  await deletePayment(context.companyId, payment.id, {
    userId: context.userId,
  });

  revalidatePath(`/loans/${payment.loanId}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/cash");
  redirect(`/loans/${payment.loanId}`);
}

/**
 * Corrige un cobro ya registrado.
 *
 * Reusa la forma del cobro nuevo, menos el préstamo: un cobro no cambia de
 * préstamo — para eso se elimina y se registra donde iba.
 */
const updateSchema = paymentSchema
  .omit({ loanId: true, cashBoxId: true })
  .extend({ paymentId: z.string().min(1) });

export async function updatePaymentAction(
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const context = await requirePermission("payments.update");

  const parsed = updateSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );
  if (!parsed.success) return { error: t("payments.errors.amountPositive") };
  const data = parsed.data;

  const payment = await db.payment.findFirst({
    where: { id: data.paymentId, companyId: context.companyId },
    select: { id: true, loanId: true },
  });
  if (!payment) return { error: t("common.error") };

  try {
    await updatePayment({
      companyId: context.companyId,
      paymentId: payment.id,
      amount: data.amount,
      method: data.method as PaymentMethod,
      paidAt: data.paidAt
        ? new Date(`${data.paidAt}T12:00:00.000Z`)
        : undefined,
      reference: data.reference || null,
      notes: data.notes || null,
      userId: context.userId,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return { error: t(`payments.errors.${error.code}`) };
    }
    throw error;
  }

  revalidatePath(`/loans/${payment.loanId}`);
  revalidatePath(`/payments/${payment.id}`);
  revalidatePath("/payments");
  revalidatePath("/cash");
  revalidatePath("/dashboard");

  return { success: t("payments.updated") };
}
