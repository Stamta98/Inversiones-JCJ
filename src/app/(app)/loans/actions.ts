"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ChargeError } from "@/core/loans/charges";
import { RenewalError } from "@/core/loans/renewal";
import { ScheduleError } from "@/core/loans/schedule";
import {
  INTEREST_METHODS,
  LATE_FEE_MODES,
  PAYMENT_FREQUENCIES,
  RATE_BASES,
} from "@/core/types";
import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import {
  LoanServiceError,
  cancelLoan,
  createLoan,
  deleteLoan,
  disburseLoan,
  updateLoan,
} from "@/server/services/loans";
import { moveLoan, resetLoanOrder } from "@/server/services/ordering";
import { RenewLoanError, renewLoan } from "@/server/services/renewals";

const loanSchema = z.object({
  customerId: z.string().min(1),
  principal: z.coerce.number().positive(),
  interestRate: z.coerce.number().min(0),
  rateBasis: z.enum(RATE_BASES as [string, ...string[]]).default("TOTAL"),
  interestMethod: z.enum(INTEREST_METHODS as [string, ...string[]]),
  frequency: z.enum(PAYMENT_FREQUENCIES as [string, ...string[]]),
  customIntervalDays: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value === undefined || value.length === 0 ? null : Number(value),
    ),
  /** Checkbox group: absent when nothing is ticked. */
  nonCollectionDays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  termCount: z.coerce.number().int().positive(),
  firstDueDate: z.string().min(1),
  lateFeeMode: z.enum(LATE_FEE_MODES as [string, ...string[]]).default("NONE"),
  lateFeeValue: z.coerce.number().min(0).default(0),
  gracePeriodDays: z.coerce.number().int().min(0).default(0),
  cashBoxId: z.string().optional(),
  disburseNow: z.string().optional(),
});

export interface LoanFormState {
  error?: string;
  /** Cuando la pantalla se queda donde está y hay que confirmar que guardó. */
  success?: string;
}

/**
 * Lee los cargos adicionales del formulario.
 *
 * Llegan como tres listas paralelas — nombre, valor y forma de cobro — porque
 * es lo que un formulario sabe mandar. Se juntan por posición y se descartan
 * las filas que quedaron vacías, que es lo que pasa cuando alguien agrega un
 * cargo y se arrepiente.
 */
function readCharges(formData: FormData) {
  const names = formData.getAll("chargeName").map(String);
  const amounts = formData.getAll("chargeAmount").map(String);
  const modes = formData.getAll("chargeMode").map(String);

  return names.flatMap((name, index) => {
    const amount = Number(amounts[index] ?? 0);
    if (name.trim().length === 0 && !(amount > 0)) return [];
    return [
      {
        name,
        amount,
        mode: (modes[index] === "FINANCED" ? "FINANCED" : "DEDUCTED") as
          | "DEDUCTED"
          | "FINANCED",
      },
    ];
  });
}

export async function createLoanAction(
  _previous: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const context = await requirePermission("loans.create");

  const parsed = loanSchema.safeParse({
    ...Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
    // A checkbox group needs every value, not just the last one.
    nonCollectionDays: formData.getAll("nonCollectionDays").map(String),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path[0];
    if (field === "customerId") {
      return { error: t("loans.errors.customerRequired") };
    }
    if (typeof field === "string") {
      const message = t(`loans.errors.${field}`);
      if (message !== `loans.errors.${field}`) return { error: message };
    }
    return { error: t("common.error") };
  }

  const data = parsed.data;
  let loanId: string;

  try {
    loanId = await createLoan({
      companyId: context.companyId,
      branchId: context.branchId,
      customerId: data.customerId,
      principal: data.principal,
      interestRate: data.interestRate,
      rateBasis: data.rateBasis as never,
      interestMethod: data.interestMethod as never,
      frequency: data.frequency as never,
      customIntervalDays: data.customIntervalDays,
      nonCollectionDays: data.nonCollectionDays,
      termCount: data.termCount,
      firstDueDate: new Date(`${data.firstDueDate}T00:00:00.000Z`),
      lateFeeMode: data.lateFeeMode as never,
      lateFeeValue: data.lateFeeValue,
      gracePeriodDays: data.gracePeriodDays,
      decimalPlaces: context.decimalPlaces,
      charges: readCharges(formData),
      disburseNow: data.disburseNow === "on",
      cashBoxId: data.cashBoxId || null,
      createdById: context.userId,
    });
  } catch (error) {
    if (error instanceof ChargeError || error instanceof ScheduleError) {
      const message = t(`loans.errors.${error.code}`);
      return {
        error:
          message === `loans.errors.${error.code}` ? error.message : message,
      };
    }
    throw error;
  }

  revalidatePath("/loans");
  revalidatePath("/cash");
  redirect(`/loans/${loanId}`);
}

/** Editing reuses the create shape, minus what only applies at disbursement. */
const updateSchema = loanSchema
  .omit({ customerId: true, cashBoxId: true, disburseNow: true })
  .extend({
    loanId: z.string().min(1),
  });

export async function updateLoanAction(
  _previous: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const context = await requirePermission("loans.update");
  const parsed = updateSchema.safeParse({
    ...Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
    nonCollectionDays: formData.getAll("nonCollectionDays").map(String),
  });

  if (!parsed.success) return { error: t("common.error") };
  const data = parsed.data;

  try {
    await updateLoan({
      companyId: context.companyId,
      loanId: data.loanId,
      terms: {
        principal: data.principal,
        interestRate: data.interestRate,
        rateBasis: data.rateBasis as never,
        interestMethod: data.interestMethod as never,
        frequency: data.frequency as never,
        customIntervalDays: data.customIntervalDays,
        nonCollectionDays: data.nonCollectionDays,
        termCount: data.termCount,
        firstDueDate: new Date(`${data.firstDueDate}T00:00:00.000Z`),
        lateFeeMode: data.lateFeeMode as never,
        lateFeeValue: data.lateFeeValue,
        gracePeriodDays: data.gracePeriodDays,
        decimalPlaces: context.decimalPlaces,
      },
      charges: readCharges(formData),
      decimalPlaces: context.decimalPlaces,
      updatedById: context.userId,
    });
  } catch (error) {
    return { error: loanErrorMessage(error) };
  }

  revalidatePath(`/loans/${data.loanId}`);
  revalidatePath("/loans");
  revalidatePath("/cash");
  redirect(`/loans/${data.loanId}`);
}

/**
 * Cambiar los cargos desde la ficha del préstamo, sin pasar por editarlo.
 *
 * Los cargos no viven aparte del plan: uno financiado se reparte entre las
 * cuotas y uno descontado ya movió la caja el día que se entregó. Por eso se
 * le vuelven a mandar al servicio las condiciones que el préstamo ya tiene —
 * sin tocar ninguna — para que rehaga el plan con los cargos nuevos, vuelva a
 * aplicar lo cobrado y mueva la caja por la diferencia. Cambiarlos a mano en
 * la tabla dejaría las cuotas diciendo una cosa y la caja otra.
 */
export async function updateLoanChargesAction(
  _previous: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const context = await requirePermission("loans.update");
  const loanId = String(formData.get("loanId") ?? "");
  if (!loanId) return { error: t("common.error") };

  const loan = await db.loan.findFirst({
    where: { id: loanId, companyId: context.companyId },
    select: {
      principal: true,
      interestRate: true,
      rateBasis: true,
      interestMethod: true,
      frequency: true,
      customIntervalDays: true,
      nonCollectionDays: true,
      termCount: true,
      firstDueDate: true,
      lateFeeMode: true,
      lateFeeValue: true,
      gracePeriodDays: true,
    },
  });
  if (!loan) return { error: t("loans.errors.notFound") };

  try {
    await updateLoan({
      companyId: context.companyId,
      loanId,
      terms: {
        principal: Number(loan.principal),
        interestRate: Number(loan.interestRate),
        rateBasis: loan.rateBasis as never,
        interestMethod: loan.interestMethod as never,
        frequency: loan.frequency as never,
        customIntervalDays: loan.customIntervalDays,
        nonCollectionDays: loan.nonCollectionDays,
        termCount: loan.termCount,
        firstDueDate: loan.firstDueDate,
        lateFeeMode: loan.lateFeeMode as never,
        lateFeeValue: Number(loan.lateFeeValue),
        gracePeriodDays: loan.gracePeriodDays,
        decimalPlaces: context.decimalPlaces,
      },
      charges: readCharges(formData),
      decimalPlaces: context.decimalPlaces,
      updatedById: context.userId,
    });
  } catch (error) {
    return { error: loanErrorMessage(error) };
  }

  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  revalidatePath("/cash");
  return { success: t("loans.charges.saved") };
}

/** Turns a service or schedule failure into a message the user can read. */
function loanErrorMessage(error: unknown): string {
  if (error instanceof ChargeError) {
    const message = t(`loans.errors.${error.code}`);
    return message === `loans.errors.${error.code}`
      ? t("common.error")
      : message;
  }
  if (error instanceof LoanServiceError) {
    const message = t(`loans.errors.${error.code}`);
    return message === `loans.errors.${error.code}`
      ? t("common.error")
      : message;
  }
  if (error instanceof ScheduleError) {
    const message = t(`loans.errors.${error.code}`);
    return message === `loans.errors.${error.code}` ? error.message : message;
  }
  throw error;
}

export async function cancelLoanAction(
  _previous: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const context = await requirePermission("loans.update");
  const loanId = String(formData.get("loanId") ?? "");
  if (!loanId) return { error: t("common.error") };

  try {
    await cancelLoan({
      companyId: context.companyId,
      loanId,
      reason: String(formData.get("reason") ?? "") || null,
      cancelledById: context.userId,
    });
  } catch (error) {
    return { error: loanErrorMessage(error) };
  }

  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
}

export async function disburseLoanAction(formData: FormData): Promise<void> {
  const context = await requirePermission("loans.approve");
  const loanId = String(formData.get("loanId") ?? "");
  const cashBoxId = String(formData.get("cashBoxId") ?? "") || null;

  await disburseLoan(loanId, { cashBoxId, userId: context.userId });

  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
}

/**
 * Refinances or renews a loan.
 *
 * The terms come from the same shape a new loan uses, minus the principal on a
 * refinance: there the balance decides it, and letting the form pick a
 * different figure would mean money moving that nobody counted.
 */
const renewSchema = loanSchema
  .omit({ customerId: true, principal: true, disburseNow: true })
  .extend({
    loanId: z.string().min(1),
    kind: z.enum(["REFINANCE", "RENEWAL"]),
    /** Absent on a refinance, where the outstanding balance is the loan. */
    principal: z.coerce.number().positive().optional(),
  });

export async function renewLoanAction(
  _previous: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const context = await requirePermission("loans.create");

  const entries = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
  const parsed = renewSchema.safeParse({
    ...entries,
    // Blank on a refinance: the balance decides the principal.
    principal: entries.principal ? entries.principal : undefined,
    nonCollectionDays: formData.getAll("nonCollectionDays").map(String),
  });

  if (!parsed.success) return { error: t("common.error") };
  const data = parsed.data;

  let created: { loanId: string };
  try {
    created = await renewLoan({
      companyId: context.companyId,
      loanId: data.loanId,
      kind: data.kind,
      principal: data.principal,
      interestRate: data.interestRate,
      rateBasis: data.rateBasis as never,
      interestMethod: data.interestMethod as never,
      frequency: data.frequency as never,
      customIntervalDays: data.customIntervalDays,
      nonCollectionDays: data.nonCollectionDays,
      termCount: data.termCount,
      firstDueDate: new Date(`${data.firstDueDate}T00:00:00.000Z`),
      lateFeeMode: data.lateFeeMode as never,
      lateFeeValue: data.lateFeeValue,
      gracePeriodDays: data.gracePeriodDays,
      decimalPlaces: context.decimalPlaces,
      charges: readCharges(formData),
      cashBoxId: data.cashBoxId || null,
      createdById: context.userId,
    });
  } catch (error) {
    if (error instanceof ChargeError) {
      const message = t(`loans.errors.${error.code}`);
      return {
        error:
          message === `loans.errors.${error.code}` ? t("common.error") : message,
      };
    }
    if (error instanceof RenewLoanError || error instanceof RenewalError) {
      const message = t(`loans.errors.${error.code}`);
      return {
        error:
          message === `loans.errors.${error.code}` ? t("common.error") : message,
      };
    }
    if (error instanceof ScheduleError) {
      const message = t(`loans.errors.${error.code}`);
      return {
        error:
          message === `loans.errors.${error.code}` ? error.message : message,
      };
    }
    throw error;
  }

  revalidatePath("/loans");
  revalidatePath(`/loans/${data.loanId}`);
  revalidatePath("/payments");
  revalidatePath("/cash");
  revalidatePath("/dashboard");
  // Straight to the new loan: its schedule is what the customer needs now.
  redirect(`/loans/${created.loanId}`);
}

/**
 * Mueve un préstamo en la lista. Igual que en clientes: llega el vecino que la
 * persona ve, no una posición, porque la lista puede venir filtrada.
 */
const moveLoanSchema = z.object({
  id: z.string().min(1),
  targetId: z.string().optional(),
  placement: z.enum(["before", "after", "top"]),
});

export async function moveLoanAction(formData: FormData): Promise<void> {
  const context = await requirePermission("loans.update");

  const parsed = moveLoanSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );
  if (!parsed.success) return;

  await moveLoan({
    companyId: context.companyId,
    id: parsed.data.id,
    targetId: parsed.data.targetId || null,
    placement: parsed.data.placement,
  });

  revalidatePath("/loans");
}

export async function resetLoanOrderAction(): Promise<void> {
  const context = await requirePermission("loans.update");
  await resetLoanOrder(context.companyId);
  revalidatePath("/loans");
}

/**
 * Borra un préstamo para siempre.
 *
 * Anular deja el préstamo cerrado y a la vista, que es lo correcto casi
 * siempre. Esto es para el que nunca debió existir, y por eso devuelve la
 * plata a la caja y deja el rastro en la auditoría.
 */
export async function deleteLoanAction(
  _previous: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const context = await requirePermission("loans.delete");
  const loanId = String(formData.get("loanId") ?? "");
  if (!loanId) return { error: t("common.error") };

  try {
    await deleteLoan(context.companyId, loanId, { userId: context.userId });
  } catch (error) {
    if (error instanceof LoanServiceError) {
      const message = t(`loans.errors.${error.code}`);
      return {
        error:
          message === `loans.errors.${error.code}` ? t("common.error") : message,
      };
    }
    throw error;
  }

  revalidatePath("/loans");
  revalidatePath("/payments");
  revalidatePath("/cash");
  revalidatePath("/dashboard");
  redirect("/loans");
}
