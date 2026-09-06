/**
 * Payment allocation.
 *
 * A payment is applied to the oldest open installment first and, within an
 * installment, in this order: late fees, then the additional charge, then
 * interest, then principal. This matches how a collector settles a receipt in
 * the field: what the loan costs on top comes off before the loan itself.
 */

import { clampToZero, type Cents } from "../money";
import type { InstallmentStatus } from "../types";

export interface AllocatableInstallment {
  id: string;
  number: number;
  dueDate: Date;
  principalCents: Cents;
  interestCents: Cents;
  /** Parte del cargo adicional que se cobra en esta cuota. */
  chargeCents: Cents;
  lateFeeCents: Cents;
  paidCents: Cents;
  status: InstallmentStatus;
}

export interface Allocation {
  installmentId: string;
  installmentNumber: number;
  lateFeeCents: Cents;
  chargeCents: Cents;
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
 * charge, interest and principal components, so we know what is still owed on
 * each. The order here is the order money is applied in.
 */
function outstandingParts(installment: AllocatableInstallment): {
  lateFee: Cents;
  charge: Cents;
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
    charge: takeFrom(installment.chargeCents),
    interest: takeFrom(installment.interestCents),
    principal: takeFrom(installment.principalCents),
  };
}

/**
 * Qué partes de la cuota puede tocar un cobro.
 *
 * Lo normal es que las toque todas, en orden. Cobrar solo la mora es otra
 * cosa: el cliente paga lo que se le sumó por atrasarse y la cuota se queda
 * como estaba, esperando su plata.
 */
export type AllocationScope = "ALL" | "LATE_FEE";

export function allocatePayment(
  amountCents: Cents,
  installments: AllocatableInstallment[],
  scope: AllocationScope = "ALL",
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
    const soloMora = scope === "LATE_FEE";

    const lateFeeCents = Math.min(remaining, owed.lateFee);
    remaining -= lateFeeCents;

    // Cobrando solo la mora, la plata se para aquí: no baja el cargo, ni el
    // interés, ni el capital, por mucha que sea.
    const chargeCents = soloMora ? 0 : Math.min(remaining, owed.charge);
    remaining -= chargeCents;

    const interestCents = soloMora ? 0 : Math.min(remaining, owed.interest);
    remaining -= interestCents;

    const principalCents = soloMora ? 0 : Math.min(remaining, owed.principal);
    remaining -= principalCents;

    const totalCents =
      lateFeeCents + chargeCents + interestCents + principalCents;
    if (totalCents <= 0) continue;

    const resultingPaidCents = installment.paidCents + totalCents;
    const installmentTotal =
      installment.principalCents +
      installment.interestCents +
      installment.chargeCents +
      installment.lateFeeCents;

    allocations.push({
      installmentId: installment.id,
      installmentNumber: installment.number,
      lateFeeCents,
      chargeCents,
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
      installment.chargeCents +
      installment.lateFeeCents -
      installment.paidCents;
    return total + clampToZero(owed);
  }, 0);
}
