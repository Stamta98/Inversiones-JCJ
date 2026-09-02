/**
 * Loan service.
 *
 * Owns everything that writes to a loan: creating it with its schedule,
 * disbursing it, and recomputing its totals and arrears after any change.
 */

import type { Prisma } from "@prisma/client";

import { summarizeArrears, type LateFeePolicy } from "@/core/loans/arrears";
import {
  canCancel,
  canEditAtAll,
  canEditTerms,
} from "@/core/loans/editable";
import { buildSchedule, type Schedule } from "@/core/loans/schedule";
import { fromCents, stepForDecimals, toCents } from "@/core/money";
import type {
  InterestMethod,
  LateFeeMode,
  PaymentFrequency,
} from "@/core/types";

import { db } from "../db";
import { nextLoanCode, withCodeRetry } from "./sequences";

export interface CreateLoanInput {
  companyId: string;
  branchId?: string | null;
  customerId: string;
  loanProductId?: string | null;
  principal: number;
  interestRate: number;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  /** Days between installments when the frequency is CUSTOM. */
  customIntervalDays?: number | null;
  /** Weekdays with no collection, 0 = Sunday through 6 = Saturday. */
  nonCollectionDays?: number[];
  termCount: number;
  firstDueDate: Date;
  lateFeeMode?: LateFeeMode;
  lateFeeValue?: number;
  gracePeriodDays?: number;
  notes?: string | null;
  /**
   * Decimals the company writes amounts with. Zero makes every installment
   * land on a whole unit, so a plan in Colombian pesos adds up to the
   * principal instead of drifting by a few pesos.
   */
  decimalPlaces?: number;
  /** Disburse straight away instead of leaving the loan as a draft. */
  disburseNow?: boolean;
  cashBoxId?: string | null;
  createdById?: string | null;
}

/** Builds the schedule without writing anything, for the preview screen. */
export function previewSchedule(
  input: Pick<
    CreateLoanInput,
    | "principal"
    | "interestRate"
    | "interestMethod"
    | "frequency"
    | "termCount"
    | "firstDueDate"
    | "customIntervalDays"
    | "nonCollectionDays"
    | "decimalPlaces"
  >,
): Schedule {
  return buildSchedule({
    principalCents: toCents(input.principal),
    interestRate: input.interestRate,
    interestMethod: input.interestMethod,
    frequency: input.frequency,
    termCount: input.termCount,
    firstDueDate: input.firstDueDate,
    customIntervalDays: input.customIntervalDays ?? undefined,
    nonCollectionDays: input.nonCollectionDays,
    minorUnitStep: stepForDecimals(input.decimalPlaces ?? 2),
  });
}

export async function createLoan(input: CreateLoanInput): Promise<string> {
  const schedule = previewSchedule(input);
  const lateFeeMode = input.lateFeeMode ?? "NONE";
  const lateFeeValue = input.lateFeeValue ?? 0;
  const gracePeriodDays = input.gracePeriodDays ?? 0;

  return withCodeRetry(() =>
    db.$transaction(async (tx) => {
      const code = await nextLoanCode(tx, input.companyId);
      const now = new Date();

      const loan = await tx.loan.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId ?? null,
          customerId: input.customerId,
          loanProductId: input.loanProductId ?? null,
          code,
          principal: input.principal,
          interestMethod: input.interestMethod,
          interestRate: input.interestRate,
          frequency: input.frequency,
          customIntervalDays: input.customIntervalDays ?? null,
          nonCollectionDays: input.nonCollectionDays ?? [],
          termCount: schedule.installments.length,
          firstDueDate: input.firstDueDate,
          disbursedAt: input.disburseNow ? now : null,
          status: input.disburseNow ? "ACTIVE" : "DRAFT",
          lateFeeMode,
          lateFeeValue,
          gracePeriodDays,
          notes: input.notes ?? null,
          totalPrincipal: fromCents(schedule.totalPrincipalCents),
          totalInterest: fromCents(schedule.totalInterestCents),
          outstanding: fromCents(schedule.totalToPayCents),
          installments: {
            create: schedule.installments.map((installment) => ({
              number: installment.number,
              dueDate: installment.dueDate,
              principalAmount: fromCents(installment.principalCents),
              interestAmount: fromCents(installment.interestCents),
              totalAmount: fromCents(installment.totalCents),
              balanceAfter: fromCents(installment.balanceAfterCents),
            })),
          },
        },
      });

      if (input.disburseNow && input.cashBoxId) {
        await recordDisbursement(tx, {
          cashBoxId: input.cashBoxId,
          amount: input.principal,
          loanCode: code,
          createdById: input.createdById ?? null,
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById ?? null,
          action: "loan.created",
          entityType: "Loan",
          entityId: loan.id,
          metadata: {
            code,
            principal: input.principal,
            interestMethod: input.interestMethod,
            termCount: schedule.installments.length,
          },
        },
      });

      return loan.id;
    }),
  );
}

export class LoanServiceError extends Error {
  constructor(
    message: string,
    readonly code: "notFound" | "termsLocked" | "closed" | "cannotCancel",
  ) {
    super(message);
    this.name = "LoanServiceError";
  }
}

export interface UpdateLoanInput {
  companyId: string;
  loanId: string;
  notes?: string | null;
  branchId?: string | null;
  /** Only accepted while the loan is still a draft; see `core/loans/editable`. */
  terms?: Pick<
    CreateLoanInput,
    | "principal"
    | "interestRate"
    | "interestMethod"
    | "frequency"
    | "customIntervalDays"
    | "nonCollectionDays"
    | "termCount"
    | "firstDueDate"
    | "lateFeeMode"
    | "lateFeeValue"
    | "gracePeriodDays"
    | "decimalPlaces"
  >;
  updatedById?: string | null;
}

/**
 * Edits a loan.
 *
 * The notes travel freely, but the terms only while the loan is a draft: past
 * that point the installments carry payments, and rewriting them would change
 * what the customer already owed. `core/loans/editable` holds that rule and
 * this function enforces it again server-side, since the UI can be bypassed.
 */
export async function updateLoan(input: UpdateLoanInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: { id: input.loanId, companyId: input.companyId },
    });
    if (!loan) throw new LoanServiceError("Loan not found", "notFound");
    if (!canEditAtAll(loan.status)) {
      throw new LoanServiceError("Loan is closed", "closed");
    }

    if (input.terms && !canEditTerms(loan.status)) {
      throw new LoanServiceError("Terms are locked", "termsLocked");
    }

    const schedule = input.terms ? previewSchedule(input.terms) : null;

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.terms && schedule
          ? {
              principal: input.terms.principal,
              interestRate: input.terms.interestRate,
              interestMethod: input.terms.interestMethod,
              frequency: input.terms.frequency,
              customIntervalDays: input.terms.customIntervalDays ?? null,
              nonCollectionDays: input.terms.nonCollectionDays ?? [],
              termCount: schedule.installments.length,
              firstDueDate: input.terms.firstDueDate,
              lateFeeMode: input.terms.lateFeeMode ?? "NONE",
              lateFeeValue: input.terms.lateFeeValue ?? 0,
              gracePeriodDays: input.terms.gracePeriodDays ?? 0,
              totalPrincipal: fromCents(schedule.totalPrincipalCents),
              totalInterest: fromCents(schedule.totalInterestCents),
              outstanding: fromCents(schedule.totalToPayCents),
            }
          : {}),
      },
    });

    if (schedule) {
      // A draft has no payments allocated, so the old schedule can simply go.
      await tx.loanInstallment.deleteMany({ where: { loanId: loan.id } });
      await tx.loanInstallment.createMany({
        data: schedule.installments.map((installment) => ({
          loanId: loan.id,
          number: installment.number,
          dueDate: installment.dueDate,
          principalAmount: fromCents(installment.principalCents),
          interestAmount: fromCents(installment.interestCents),
          totalAmount: fromCents(installment.totalCents),
          balanceAfter: fromCents(installment.balanceAfterCents),
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.updatedById ?? null,
        action: "loan.updated",
        entityType: "Loan",
        entityId: loan.id,
        metadata: { code: loan.code, termsChanged: schedule !== null },
      },
    });
  });
}

/**
 * Cancels a loan. Nothing is deleted: the record and its schedule stay, so the
 * history of what was agreed and what was collected remains readable.
 */
export async function cancelLoan(input: {
  companyId: string;
  loanId: string;
  reason?: string | null;
  cancelledById?: string | null;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: { id: input.loanId, companyId: input.companyId },
    });
    if (!loan) throw new LoanServiceError("Loan not found", "notFound");
    if (!canCancel(loan.status)) {
      throw new LoanServiceError("Loan cannot be cancelled", "cannotCancel");
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: { status: "CANCELLED", closingDate: new Date() },
    });

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.cancelledById ?? null,
        action: "loan.cancelled",
        entityType: "Loan",
        entityId: loan.id,
        metadata: { code: loan.code, reason: input.reason ?? null },
      },
    });
  });
}

async function recordDisbursement(
  tx: Prisma.TransactionClient,
  input: {
    cashBoxId: string;
    amount: number;
    loanCode: string;
    createdById: string | null;
  },
): Promise<void> {
  const cashBox = await tx.cashBox.findUniqueOrThrow({
    where: { id: input.cashBoxId },
    select: { balance: true },
  });

  const balanceAfter = Number(cashBox.balance) - input.amount;

  await tx.cashBox.update({
    where: { id: input.cashBoxId },
    data: { balance: balanceAfter },
  });

  await tx.cashMovement.create({
    data: {
      cashBoxId: input.cashBoxId,
      kind: "LOAN_DISBURSEMENT",
      amount: -input.amount,
      balanceAfter,
      description: `Desembolso ${input.loanCode}`,
      createdById: input.createdById,
    },
  });
}

export function lateFeePolicyOf(
  loan: {
    lateFeeMode: string;
    lateFeeValue: Prisma.Decimal | number;
    gracePeriodDays: number;
  },
  decimalPlaces = 2,
): LateFeePolicy {
  const rawValue = Number(loan.lateFeeValue);
  const mode = loan.lateFeeMode as LateFeeMode;

  return {
    mode,
    // The fixed modes store an amount of money; the percent modes store a rate.
    value:
      mode === "FIXED_PER_DAY" || mode === "FIXED_ONCE"
        ? toCents(rawValue)
        : rawValue,
    gracePeriodDays: loan.gracePeriodDays,
    minorUnitStep: stepForDecimals(decimalPlaces),
  };
}

/**
 * Recomputes late fees, installment statuses, denormalized totals and the loan
 * status. Called after every payment and by the nightly job.
 */
export async function refreshLoan(
  tx: Prisma.TransactionClient,
  loanId: string,
  asOf: Date = new Date(),
): Promise<void> {
  const loan = await tx.loan.findUniqueOrThrow({
    where: { id: loanId },
    include: {
      installments: { orderBy: { number: "asc" } },
      // The late fee has to be a chargeable amount too, and how small that is
      // depends on the company's currency.
      company: { select: { decimalPlaces: true } },
    },
  });

  if (loan.status === "CANCELLED" || loan.status === "WRITTEN_OFF") return;

  const policy = lateFeePolicyOf(loan, loan.company.decimalPlaces);
  const snapshots = loan.installments.map((installment) => ({
    id: installment.id,
    number: installment.number,
    dueDate: installment.dueDate,
    principalCents: toCents(Number(installment.principalAmount)),
    interestCents: toCents(Number(installment.interestAmount)),
    lateFeeCents: toCents(Number(installment.lateFeeAmount)),
    paidCents: toCents(Number(installment.paidAmount)),
    status: installment.status,
  }));

  const summary = summarizeArrears(snapshots, policy, asOf);

  // Refresh each installment's late fee and status.
  let totalPaidCents = 0;
  let totalLateFeeCents = 0;
  let outstandingCents = 0;

  for (const snapshot of snapshots) {
    const dueCents = snapshot.principalCents + snapshot.interestCents;
    const isSettled = snapshot.status === "PAID" || snapshot.status === "WAIVED";

    const lateFeeCents = isSettled
      ? snapshot.lateFeeCents
      : Math.max(
          snapshot.lateFeeCents,
          // Recompute from scratch so a fee never shrinks below what was paid.
          summarizeArrears([snapshot], policy, asOf).lateFeeCents,
        );

    const owedCents = Math.max(
      0,
      dueCents + lateFeeCents - snapshot.paidCents,
    );

    let status = snapshot.status;
    if (!isSettled) {
      if (snapshot.paidCents >= dueCents + lateFeeCents) {
        status = "PAID";
      } else if (snapshot.dueDate < asOf) {
        status = "OVERDUE";
      } else if (snapshot.paidCents > 0) {
        status = "PARTIALLY_PAID";
      } else {
        status = "PENDING";
      }
    }

    if (
      lateFeeCents !== snapshot.lateFeeCents ||
      status !== snapshot.status
    ) {
      await tx.loanInstallment.update({
        where: { id: snapshot.id },
        data: {
          lateFeeAmount: fromCents(lateFeeCents),
          totalAmount: fromCents(dueCents + lateFeeCents),
          status,
          paidAt: status === "PAID" ? (asOf ?? new Date()) : null,
        },
      });
    }

    totalPaidCents += snapshot.paidCents;
    totalLateFeeCents += lateFeeCents;
    outstandingCents += owedCents;
  }

  const isPaid = outstandingCents === 0;
  const nextStatus =
    loan.status === "DRAFT" || loan.status === "PENDING_APPROVAL"
      ? loan.status
      : isPaid
        ? "PAID"
        : summary.daysInArrears > 0
          ? "IN_ARREARS"
          : "ACTIVE";

  await tx.loan.update({
    where: { id: loanId },
    data: {
      totalPaid: fromCents(totalPaidCents),
      totalLateFees: fromCents(totalLateFeeCents),
      outstanding: fromCents(outstandingCents),
      daysInArrears: summary.daysInArrears,
      status: nextStatus,
      closingDate: isPaid ? (loan.closingDate ?? asOf) : null,
    },
  });
}

export async function disburseLoan(
  loanId: string,
  options: { cashBoxId?: string | null; userId?: string | null } = {},
): Promise<void> {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
    if (loan.status !== "DRAFT" && loan.status !== "APPROVED") return;

    await tx.loan.update({
      where: { id: loanId },
      data: { status: "ACTIVE", disbursedAt: new Date() },
    });

    if (options.cashBoxId) {
      await recordDisbursement(tx, {
        cashBoxId: options.cashBoxId,
        amount: Number(loan.principal),
        loanCode: loan.code,
        createdById: options.userId ?? null,
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: loan.companyId,
        userId: options.userId ?? null,
        action: "loan.disbursed",
        entityType: "Loan",
        entityId: loanId,
        metadata: { code: loan.code },
      },
    });

    await refreshLoan(tx, loanId);
  });
}
