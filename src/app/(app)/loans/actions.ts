"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ScheduleError } from "@/core/loans/schedule";
import {
  INTEREST_METHODS,
  LATE_FEE_MODES,
  PAYMENT_FREQUENCIES,
} from "@/core/types";
import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { createLoan, disburseLoan } from "@/server/services/loans";

const loanSchema = z.object({
  customerId: z.string().min(1),
  principal: z.coerce.number().positive(),
  interestRate: z.coerce.number().min(0),
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
  nonCollectionDays: z
    .array(z.coerce.number().int().min(0).max(6))
    .default([]),
  termCount: z.coerce.number().int().positive(),
  firstDueDate: z.string().min(1),
  lateFeeMode: z.enum(LATE_FEE_MODES as [string, ...string[]]).default("NONE"),
  lateFeeValue: z.coerce.number().min(0).default(0),
  gracePeriodDays: z.coerce.number().int().min(0).default(0),
  cashBoxId: z.string().optional(),
  disburseNow: z.string().optional(),
  notes: z.string().optional(),
});

export interface LoanFormState {
  error?: string;
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
      interestMethod: data.interestMethod as never,
      frequency: data.frequency as never,
      customIntervalDays: data.customIntervalDays,
      nonCollectionDays: data.nonCollectionDays,
      termCount: data.termCount,
      firstDueDate: new Date(`${data.firstDueDate}T00:00:00.000Z`),
      lateFeeMode: data.lateFeeMode as never,
      lateFeeValue: data.lateFeeValue,
      gracePeriodDays: data.gracePeriodDays,
      notes: data.notes || null,
      disburseNow: data.disburseNow === "on",
      cashBoxId: data.cashBoxId || null,
      createdById: context.userId,
    });
  } catch (error) {
    if (error instanceof ScheduleError) {
      const message = t(`loans.errors.${error.code}`);
      return {
        error: message === `loans.errors.${error.code}` ? error.message : message,
      };
    }
    throw error;
  }

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
