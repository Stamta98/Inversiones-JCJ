/**
 * Refinancing and renewing a loan.
 *
 * Both replace a loan that still owes money with a new one. What separates
 * them is the cash: a refinance moves the balance across and nothing leaves
 * the box, while a renewal lends a larger amount and hands over the
 * difference.
 *
 * Three things this has to get right, and each of them is a way the books go
 * wrong if it is done as an ordinary loan plus an ordinary payment:
 *
 * - The old loan is settled by the new one, not paid. The settling payment is
 *   recorded with the REFINANCE method precisely so it never counts as cash a
 *   collector brought in — `expectedCashFor` only looks at CASH.
 * - Only the net reaches the cash box. Booking the full principal out and the
 *   balance back in would net to the same figure but would credit the day with
 *   a collection that never happened, and leave the drawer short.
 * - It all happens in one transaction. A new loan without its old one settled
 *   would have the customer owing the same money twice.
 */

import { allocatePayment } from "@/core/loans/allocation";
import { planRenewal, type RenewalKind } from "@/core/loans/renewal";
import { buildSchedule } from "@/core/loans/schedule";
import { fromCents, stepForDecimals, toCents } from "@/core/money";
import { t } from "@/i18n";
import type {
  InterestMethod,
  LateFeeMode,
  PaymentFrequency,
  RateBasis,
} from "@/core/types";

import { db } from "../db";
import { recordDisbursement, refreshLoan } from "./loans";
import { refreshPromisesForCustomer } from "./promises";
import { nextLoanCode, nextReceiptNumber, withCodeRetry } from "./sequences";

export interface RenewLoanInput {
  companyId: string;
  /** The loan being replaced. */
  loanId: string;
  kind: RenewalKind;
  /** The new loan's principal. Ignored when refinancing. */
  principal?: number;
  interestRate: number;
  rateBasis?: RateBasis;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  customIntervalDays?: number | null;
  nonCollectionDays?: number[];
  termCount: number;
  firstDueDate: Date;
  lateFeeMode?: LateFeeMode;
  lateFeeValue?: number;
  gracePeriodDays?: number;
  notes?: string | null;
  decimalPlaces?: number;
  /** Where the net cash comes out of. Unused by a refinance: nothing moves. */
  cashBoxId?: string | null;
  createdById?: string | null;
}

export class RenewLoanError extends Error {
  constructor(
    message: string,
    readonly code: "notFound" | "notRenewable" | "alreadyRenewed",
  ) {
    super(message);
    this.name = "RenewLoanError";
  }
}

export interface RenewLoanResult {
  loanId: string;
  code: string;
  /** Carried over from the old loan onto the new one. */
  settledAmount: number;
  principal: number;
  /** What the customer physically receives. Zero for a refinance. */
  cashOut: number;
}

/**
 * What a loan looks like to the refinance screen before anything is decided.
 *
 * The balance is refreshed first, because late fees accrue with the calendar:
 * quoting yesterday's balance would carry the wrong figure onto the new loan.
 */
export async function loadRenewable(
  companyId: string,
  loanId: string,
): Promise<{
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  outstanding: number;
  principal: number;
  interestRate: number;
  rateBasis: RateBasis;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  customIntervalDays: number | null;
  nonCollectionDays: number[];
  termCount: number;
  lateFeeMode: LateFeeMode;
  lateFeeValue: number;
  gracePeriodDays: number;
} | null> {
  const exists = await db.loan.findFirst({
    where: { id: loanId, companyId },
    select: { id: true },
  });
  if (!exists) return null;

  await db.$transaction((tx) => refreshLoan(tx, loanId));

  const loan = await db.loan.findFirst({
    where: { id: loanId, companyId },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });
  if (!loan) return null;

  return {
    id: loan.id,
    code: loan.code,
    customerId: loan.customerId,
    customerName: `${loan.customer.firstName} ${loan.customer.lastName}`.trim(),
    outstanding: Number(loan.outstanding),
    principal: Number(loan.principal),
    interestRate: Number(loan.interestRate),
    rateBasis: loan.rateBasis as RateBasis,
    interestMethod: loan.interestMethod as InterestMethod,
    frequency: loan.frequency as PaymentFrequency,
    customIntervalDays: loan.customIntervalDays,
    nonCollectionDays: loan.nonCollectionDays,
    termCount: loan.termCount,
    lateFeeMode: loan.lateFeeMode as LateFeeMode,
    lateFeeValue: Number(loan.lateFeeValue),
    gracePeriodDays: loan.gracePeriodDays,
  };
}

/** A loan can only be replaced while it is out with the customer. */
const RENEWABLE_STATUSES = new Set(["ACTIVE", "IN_ARREARS", "APPROVED"]);

export async function renewLoan(
  input: RenewLoanInput,
): Promise<RenewLoanResult> {
  const step = stepForDecimals(input.decimalPlaces ?? 2);

  const result = await withCodeRetry(() =>
    db.$transaction(async (tx) => {
      const previous = await tx.loan.findFirst({
        where: { id: input.loanId, companyId: input.companyId },
        include: { installments: { orderBy: { number: "asc" } } },
      });
      if (!previous) {
        throw new RenewLoanError("Loan not found", "notFound");
      }
      if (!RENEWABLE_STATUSES.has(previous.status)) {
        throw new RenewLoanError("Loan is not open", "notRenewable");
      }

      // Two people refinancing the same loan at once would settle it twice and
      // leave the customer owing two new loans for one old balance.
      const existing = await tx.loan.findFirst({
        where: { parentLoanId: previous.id, status: { not: "CANCELLED" } },
        select: { code: true },
      });
      if (existing) {
        throw new RenewLoanError(
          `Already replaced by ${existing.code}`,
          "alreadyRenewed",
        );
      }

      // Late fees accrue with the calendar, so the balance is brought up to
      // today before it is quoted onto the new loan.
      await refreshLoan(tx, previous.id);
      const refreshed = await tx.loan.findUniqueOrThrow({
        where: { id: previous.id },
        include: { installments: { orderBy: { number: "asc" } } },
      });

      const plan = planRenewal({
        kind: input.kind,
        outstandingCents: toCents(Number(refreshed.outstanding)),
        newPrincipalCents:
          input.principal === undefined ? undefined : toCents(input.principal),
        step,
      });

      const now = new Date();

      // --- Settle the old loan with the new one ---------------------------
      const allocatable = refreshed.installments.map((installment) => ({
        id: installment.id,
        number: installment.number,
        dueDate: installment.dueDate,
        principalCents: toCents(Number(installment.principalAmount)),
        interestCents: toCents(Number(installment.interestAmount)),
        lateFeeCents: toCents(Number(installment.lateFeeAmount)),
        paidCents: toCents(Number(installment.paidAmount)),
        status: installment.status,
      }));

      const allocation = allocatePayment(plan.settledCents, allocatable);
      const receiptNumber = await nextReceiptNumber(tx, input.companyId);

      const settlement = await tx.payment.create({
        data: {
          companyId: input.companyId,
          loanId: refreshed.id,
          // No cash box: this balance moved onto another loan, it did not
          // arrive as money.
          cashBoxId: null,
          receiptNumber,
          amount: fromCents(plan.settledCents),
          method: "REFINANCE",
          paidAt: now,
          collectedById: input.createdById ?? null,
          allocations: {
            create: allocation.allocations.map((entry) => ({
              installmentId: entry.installmentId,
              principalAmount: fromCents(entry.principalCents),
              interestAmount: fromCents(entry.interestCents),
              lateFeeAmount: fromCents(entry.lateFeeCents),
            })),
          },
        },
      });

      for (const entry of allocation.allocations) {
        await tx.loanInstallment.update({
          where: { id: entry.installmentId },
          data: {
            paidAmount: fromCents(entry.resultingPaidCents),
            status: entry.resultingStatus,
            paidAt: entry.resultingStatus === "PAID" ? now : null,
          },
        });
      }

      // --- The new loan ---------------------------------------------------
      const schedule = buildSchedule({
        principalCents: plan.newPrincipalCents,
        interestRate: input.interestRate,
        rateBasis: input.rateBasis ?? "TOTAL",
        interestMethod: input.interestMethod,
        frequency: input.frequency,
        termCount: input.termCount,
        firstDueDate: input.firstDueDate,
        customIntervalDays: input.customIntervalDays ?? undefined,
        nonCollectionDays: input.nonCollectionDays,
        minorUnitStep: step,
      });

      const code = await nextLoanCode(tx, input.companyId);
      const principal = fromCents(plan.newPrincipalCents);

      const loan = await tx.loan.create({
        data: {
          companyId: input.companyId,
          branchId: refreshed.branchId,
          customerId: refreshed.customerId,
          loanProductId: refreshed.loanProductId,
          code,
          origin: plan.kind,
          parentLoanId: refreshed.id,
          principal,
          interestMethod: input.interestMethod,
          interestRate: input.interestRate,
          rateBasis: input.rateBasis ?? "TOTAL",
          frequency: input.frequency,
          customIntervalDays: input.customIntervalDays ?? null,
          nonCollectionDays: input.nonCollectionDays ?? [],
          termCount: schedule.installments.length,
          firstDueDate: input.firstDueDate,
          // A refinance or a renewal only means anything once it happens:
          // leaving it as a draft would settle the old loan against nothing.
          disbursedAt: now,
          status: "ACTIVE",
          lateFeeMode: input.lateFeeMode ?? "NONE",
          lateFeeValue: input.lateFeeValue ?? 0,
          gracePeriodDays: input.gracePeriodDays ?? 0,
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

      // Only what actually leaves the drawer. On a refinance that is nothing.
      if (plan.cashOutCents > 0 && input.cashBoxId) {
        await recordDisbursement(tx, {
          cashBoxId: input.cashBoxId,
          amount: fromCents(plan.cashOutCents),
          loanCode: `${code} (${refreshed.code})`,
          createdById: input.createdById ?? null,
        });
      }

      // Written now that the new loan has a code: the receipt has to say what
      // absorbed the balance, or it reads as money that vanished.
      await tx.payment.update({
        where: { id: settlement.id },
        data: { notes: `${t("loans.renewal.settledWith")} ${code}` },
      });

      await refreshLoan(tx, refreshed.id, now);
      await refreshLoan(tx, loan.id, now);

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById ?? null,
          action: plan.kind === "REFINANCE" ? "loan.refinanced" : "loan.renewed",
          entityType: "Loan",
          entityId: loan.id,
          metadata: {
            code,
            previousCode: refreshed.code,
            previousLoanId: refreshed.id,
            settledAmount: fromCents(plan.settledCents),
            principal,
            cashOut: fromCents(plan.cashOutCents),
            receiptNumber,
          },
        },
      });

      return {
        loanId: loan.id,
        code,
        settledAmount: fromCents(plan.settledCents),
        principal,
        cashOut: fromCents(plan.cashOutCents),
        customerId: refreshed.customerId,
      };
    }),
  );

  // Outside the transaction: a promise that fails to update must never roll
  // back a loan that was already handed over.
  await refreshPromisesForCustomer(input.companyId, result.customerId).catch(
    () => undefined,
  );

  return result;
}
