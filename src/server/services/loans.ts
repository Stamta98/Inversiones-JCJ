/**
 * Loan service.
 *
 * Owns everything that writes to a loan: creating it with its schedule,
 * disbursing it, and recomputing its totals and arrears after any change.
 */

import type { Prisma } from "@prisma/client";

import { summarizeArrears, type LateFeePolicy } from "@/core/loans/arrears";
import { buildSchedule, type Schedule } from "@/core/loans/schedule";
import { fromCents, toCents } from "@/core/money";
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
  termCount: number;
  firstDueDate: Date;
  lateFeeMode?: LateFeeMode;
  lateFeeValue?: number;
  gracePeriodDays?: number;
  notes?: string | null;
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
  >,
): Schedule {
  return buildSchedule({
    principalCents: toCents(input.principal),
    interestRate: input.interestRate,
    interestMethod: input.interestMethod,
    frequency: input.frequency,
    termCount: input.termCount,
    firstDueDate: input.firstDueDate,
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

export function lateFeePolicyOf(loan: {
  lateFeeMode: string;
  lateFeeValue: Prisma.Decimal | number;
  gracePeriodDays: number;
}): LateFeePolicy {
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
    include: { installments: { orderBy: { number: "asc" } } },
  });

  if (loan.status === "CANCELLED" || loan.status === "WRITTEN_OFF") return;

  const policy = lateFeePolicyOf(loan);
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
