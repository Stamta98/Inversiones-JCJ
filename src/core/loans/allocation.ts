/**
 * Payment allocation.
 *
 * A payment is applied to the oldest open installment first and, within an
 * installment, in this order: late fees, then interest, then principal. This
 * matches how a collector settles a receipt in the field.
 */

import { clampToZero, type Cents } from "../money";
import type { InstallmentStatus } from "../types";

export interface AllocatableInstallment {
  id: string;
  number: number;
  dueDate: Date;
  principalCents: Cents;
  interestCents: Cents;
  lateFeeCents: Cents;
  paidCents: Cents;
  status: InstallmentStatus;
}

export interface Allocation {
  installmentId: string;
  installmentNumber: number;
  lateFeeCents: Cents;
  interestCents: Cents;
  principalCents: Cents;
  totalCents: Cents;
  /** Status the installment ends up in after this allocation. */
  resultingStatus: InstallmentStatus;
  resultingPaidCents: Cents;
}

export interface AllocationResult {
  allocations: Allocation[];
  appliedCents: Cents;
  /** Money left over once every open installment is settled. */
  unappliedCents: Cents;
}

/**
 * Splits an already recorded `paidCents` amount back into its late fee,
 * interest and principal components, so we know what is still owed on each.
 */
function outstandingParts(installment: AllocatableInstallment): {
  lateFee: Cents;
  interest: Cents;
  principal: Cents;
} {
  let remainingPaid = installment.paidCents;

  const takeFrom = (bucket: Cents): Cents => {
    const consumed = Math.min(remainingPaid, bucket);
    remainingPaid -= consumed;
    return clampToZero(bucket - consumed);
  };

  return {
    lateFee: takeFrom(installment.lateFeeCents),
    interest: takeFrom(installment.interestCents),
    principal: takeFrom(installment.principalCents),
  };
}

export function allocatePayment(
  amountCents: Cents,
  installments: AllocatableInstallment[],
): AllocationResult {
  if (amountCents <= 0) {
    return { allocations: [], appliedCents: 0, unappliedCents: 0 };
  }

  const open = installments
    .filter(
      (installment) =>
        installment.status !== "PAID" && installment.status !== "WAIVED",
    )
    .sort((a, b) => {
      const byDate = a.dueDate.getTime() - b.dueDate.getTime();
      return byDate !== 0 ? byDate : a.number - b.number;
    });

  const allocations: Allocation[] = [];
  let remaining = amountCents;

  for (const installment of open) {
    if (remaining <= 0) break;

    const owed = outstandingParts(installment);
    const lateFeeCents = Math.min(remaining, owed.lateFee);
    remaining -= lateFeeCents;

    const interestCents = Math.min(remaining, owed.interest);
    remaining -= interestCents;

    const principalCents = Math.min(remaining, owed.principal);
    remaining -= principalCents;

    const totalCents = lateFeeCents + interestCents + principalCents;
    if (totalCents <= 0) continue;

    const resultingPaidCents = installment.paidCents + totalCents;
    const installmentTotal =
      installment.principalCents +
      installment.interestCents +
      installment.lateFeeCents;

    allocations.push({
      installmentId: installment.id,
      installmentNumber: installment.number,
      lateFeeCents,
      interestCents,
      principalCents,
      totalCents,
      resultingPaidCents,
      resultingStatus:
        resultingPaidCents >= installmentTotal ? "PAID" : "PARTIALLY_PAID",
    });
  }

  return {
    allocations,
    appliedCents: amountCents - remaining,
    unappliedCents: remaining,
  };
}

/** Total still owed across every open installment, late fees included. */
export function outstandingBalance(
  installments: AllocatableInstallment[],
): Cents {
  return installments.reduce((total, installment) => {
    if (installment.status === "PAID" || installment.status === "WAIVED") {
      return total;
    }
    const owed =
      installment.principalCents +
      installment.interestCents +
      installment.lateFeeCents -
      installment.paidCents;
    return total + clampToZero(owed);
  }, 0);
}
