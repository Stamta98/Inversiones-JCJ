/**
 * Payment service.
 *
 * Posting a payment allocates it across the open installments, moves the money
 * into a cash box, and refreshes the loan. Reversing one undoes all three.
 */

import type { Prisma } from "@prisma/client";

import { allocatePayment } from "@/core/loans/allocation";
import { fromCents, toCents } from "@/core/money";

import { db } from "../db";
import { refreshLoan } from "./loans";
import { refreshPromisesForCustomer } from "./promises";
import { nextReceiptNumber, withCodeRetry } from "./sequences";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHECK"
  | "MOBILE_WALLET"
  | "OTHER";

export interface PostPaymentInput {
  companyId: string;
  loanId: string;
  amount: number;
  method?: PaymentMethod;
  paidAt?: Date;
  cashBoxId?: string | null;
  reference?: string | null;
  notes?: string | null;
  collectedById?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "amount"
      | "loanNotActive"
      | "nothingToApply"
      | "settlesRefinance",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export interface PostPaymentResult {
  paymentId: string;
  receiptNumber: string;
  appliedAmount: number;
  unappliedAmount: number;
}

export async function postPayment(
  input: PostPaymentInput,
): Promise<PostPaymentResult> {
  if (!(input.amount > 0)) {
    throw new PaymentError("Amount must be greater than zero", "amount");
  }

  const paidAt = input.paidAt ?? new Date();

  const posted = await withCodeRetry(() =>
    db.$transaction(async (tx) => {
      const loan = await tx.loan.findUniqueOrThrow({
        where: { id: input.loanId },
        include: { installments: { orderBy: { number: "asc" } } },
      });

      if (
        loan.status === "DRAFT" ||
        loan.status === "CANCELLED" ||
        loan.status === "PENDING_APPROVAL"
      ) {
        throw new PaymentError("Loan is not active", "loanNotActive");
      }

      const allocatable = loan.installments.map((installment) => ({
        id: installment.id,
        number: installment.number,
        dueDate: installment.dueDate,
        principalCents: toCents(Number(installment.principalAmount)),
        interestCents: toCents(Number(installment.interestAmount)),
        lateFeeCents: toCents(Number(installment.lateFeeAmount)),
        paidCents: toCents(Number(installment.paidAmount)),
        status: installment.status,
      }));

      const result = allocatePayment(toCents(input.amount), allocatable);
      if (result.allocations.length === 0) {
        throw new PaymentError(
          "This loan has no open installments",
          "nothingToApply",
        );
      }

      const receiptNumber = await nextReceiptNumber(tx, input.companyId);

      const payment = await tx.payment.create({
        data: {
          companyId: input.companyId,
          loanId: input.loanId,
          cashBoxId: input.cashBoxId ?? null,
          receiptNumber,
          amount: input.amount,
          method: input.method ?? "CASH",
          paidAt,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          collectedById: input.collectedById ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          allocations: {
            create: result.allocations.map((allocation) => ({
              installmentId: allocation.installmentId,
              principalAmount: fromCents(allocation.principalCents),
              interestAmount: fromCents(allocation.interestCents),
              lateFeeAmount: fromCents(allocation.lateFeeCents),
            })),
          },
        },
      });

      for (const allocation of result.allocations) {
        await tx.loanInstallment.update({
          where: { id: allocation.installmentId },
          data: {
            paidAmount: fromCents(allocation.resultingPaidCents),
            status: allocation.resultingStatus,
            paidAt: allocation.resultingStatus === "PAID" ? paidAt : null,
          },
        });
      }

      if (input.cashBoxId) {
        const cashBox = await tx.cashBox.findUniqueOrThrow({
          where: { id: input.cashBoxId },
          select: { balance: true },
        });
        const balanceAfter = Number(cashBox.balance) + input.amount;

        await tx.cashBox.update({
          where: { id: input.cashBoxId },
          data: { balance: balanceAfter },
        });
        await tx.cashMovement.create({
          data: {
            cashBoxId: input.cashBoxId,
            kind: "PAYMENT_RECEIVED",
            amount: input.amount,
            balanceAfter,
            description: `Recibo ${receiptNumber}`,
            paymentId: payment.id,
            createdById: input.collectedById ?? null,
          },
        });
      }

      await refreshLoan(tx, input.loanId, paidAt);

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.collectedById ?? null,
          action: "payment.posted",
          entityType: "Payment",
          entityId: payment.id,
          metadata: { receiptNumber, amount: input.amount },
        },
      });

      return {
        paymentId: payment.id,
        receiptNumber,
        appliedAmount: fromCents(result.appliedCents),
        unappliedAmount: fromCents(result.unappliedCents),
        customerId: loan.customerId,
      };
    }),
  );

  // Outside the transaction on purpose: a promise that fails to update must
  // never roll back money that was already taken.
  await refreshPromisesForCustomer(input.companyId, posted.customerId).catch(
    () => undefined,
  );

  return posted;
}

/**
 * Refuses to undo the payment that settled a refinance on its own.
 *
 * That balance did not disappear: it became the principal of another loan.
 * Putting it back while that loan still stands would have the customer owing
 * the same money twice. The way out is to cancel the loan that absorbed it,
 * which reverses this payment as part of the same move.
 */
async function guardRefinanceSettlement(
  tx: Prisma.TransactionClient,
  payment: { method: string; loanId: string },
): Promise<void> {
  if (payment.method !== "REFINANCE") return;

  const replacement = await tx.loan.findFirst({
    where: { parentLoanId: payment.loanId, status: { not: "CANCELLED" } },
    select: { code: true },
  });
  if (replacement) {
    throw new PaymentError(
      `Settled by ${replacement.code}`,
      "settlesRefinance",
    );
  }
}

export async function reversePayment(
  paymentId: string,
  options: {
    reason?: string;
    userId?: string | null;
    /** Set when the refinance itself is being undone, which is the one time
     *  the settling payment may be reversed. */
    allowRefinanceSettlement?: boolean;
  } = {},
): Promise<void> {
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { allocations: true },
    });

    if (payment.status === "REVERSED") return;
    if (!options.allowRefinanceSettlement) {
      await guardRefinanceSettlement(tx, payment);
    }

    for (const allocation of payment.allocations) {
      const installment = await tx.loanInstallment.findUniqueOrThrow({
        where: { id: allocation.installmentId },
      });

      const returnedCents =
        toCents(Number(allocation.principalAmount)) +
        toCents(Number(allocation.interestAmount)) +
        toCents(Number(allocation.lateFeeAmount));

      const remainingPaidCents = Math.max(
        0,
        toCents(Number(installment.paidAmount)) - returnedCents,
      );

      await tx.loanInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmount: fromCents(remainingPaidCents),
          status: remainingPaidCents > 0 ? "PARTIALLY_PAID" : "PENDING",
          paidAt: null,
        },
      });
    }

    if (payment.cashBoxId) {
      const cashBox = await tx.cashBox.findUniqueOrThrow({
        where: { id: payment.cashBoxId },
        select: { balance: true },
      });
      const balanceAfter = Number(cashBox.balance) - Number(payment.amount);

      await tx.cashBox.update({
        where: { id: payment.cashBoxId },
        data: { balance: balanceAfter },
      });
      await tx.cashMovement.create({
        data: {
          cashBoxId: payment.cashBoxId,
          kind: "ADJUSTMENT",
          amount: -Number(payment.amount),
          balanceAfter,
          description: `Anulación recibo ${payment.receiptNumber}`,
          paymentId: payment.id,
          createdById: options.userId ?? null,
        },
      });
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversalNote: options.reason ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: payment.companyId,
        userId: options.userId ?? null,
        action: "payment.reversed",
        entityType: "Payment",
        entityId: paymentId,
        metadata: {
          receiptNumber: payment.receiptNumber,
          reason: options.reason ?? null,
        },
      },
    });

    await refreshLoan(tx, payment.loanId);
  });
}

/**
 * Removes a payment for good.
 *
 * Deleting money is not the same as forgetting it happened. A payment that is
 * still posted is reversed first — the installments go back to what they were
 * and the cash box gives the money back — and only then does the row go. Doing
 * it the other way round would leave a cash box claiming money it never had.
 *
 * The audit log keeps what was deleted, which is the whole point of being
 * allowed to delete at all.
 */
export async function deletePayment(
  companyId: string,
  paymentId: string,
  options: { userId?: string | null } = {},
): Promise<void> {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, companyId },
    select: {
      id: true,
      status: true,
      method: true,
      receiptNumber: true,
      amount: true,
      loanId: true,
      paidAt: true,
    },
  });
  if (!payment) return;

  await db.$transaction((tx) => guardRefinanceSettlement(tx, payment));

  if (payment.status !== "REVERSED") {
    await reversePayment(payment.id, {
      reason: "Eliminado",
      userId: options.userId ?? null,
    });
  }

  await db.$transaction(async (tx) => {
    // The movement points at the payment; it has to go first or the row cannot.
    await tx.cashMovement.deleteMany({ where: { paymentId: payment.id } });
    await tx.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });
    await tx.payment.delete({ where: { id: payment.id } });

    await tx.auditLog.create({
      data: {
        companyId,
        userId: options.userId ?? null,
        action: "payment.deleted",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          receiptNumber: payment.receiptNumber,
          amount: Number(payment.amount),
          paidAt: payment.paidAt.toISOString(),
          loanId: payment.loanId,
        },
      },
    });
  });

  await db.$transaction((tx) => refreshLoan(tx, payment.loanId));
}
