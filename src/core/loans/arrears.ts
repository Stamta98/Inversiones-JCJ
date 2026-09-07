/**
 * Late fee ("mora") and arrears calculation.
 */

import { daysBetween, startOfDay } from "../dates";
import {
  clampToZero,
  percentOf,
  roundToStep,
  type Cents,
  type MinorUnitStep,
} from "../money";
import { isAfterEndLateFee } from "../types";
import type { InstallmentStatus, LateFeeMode } from "../types";

export interface LateFeePolicy {
  mode: LateFeeMode;
  /** Percentage or fixed amount in cents, depending on the mode. */
  value: number;
  /** Days after the due date before a late fee starts accruing. */
  gracePeriodDays: number;
  /** Optional ceiling as a percentage of the installment. 0 means no cap. */
  maxPercentOfInstallment?: number;
  /**
   * Smallest chargeable amount. A late fee of 3,33 pesos colombianos cannot be
   * collected, so it is rounded like every other amount.
   */
  minorUnitStep?: MinorUnitStep;
}

export interface InstallmentSnapshot {
  id: string;
  number: number;
  dueDate: Date;
  principalCents: Cents;
  interestCents: Cents;
  lateFeeCents: Cents;
  paidCents: Cents;
  status: InstallmentStatus;
}

/** Days past due, ignoring the grace period. Zero when not yet due. */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  return Math.max(0, daysBetween(startOfDay(dueDate), startOfDay(asOf)));
}

/** Days that actually accrue a late fee, after the grace period is consumed. */
export function chargeableLateDays(
  dueDate: Date,
  asOf: Date,
  gracePeriodDays: number,
): number {
  return Math.max(0, daysOverdue(dueDate, asOf) - Math.max(0, gracePeriodDays));
}

/**
 * Late fee owed on a single installment as of a given date.
 *
 * Only the unpaid portion of the installment accrues a fee, so a customer who
 * pays most of an installment late is not charged as if they paid nothing.
 */
export function calculateLateFee(
  installment: Pick<
    InstallmentSnapshot,
    "dueDate" | "principalCents" | "interestCents" | "paidCents" | "status"
  >,
  policy: LateFeePolicy,
  asOf: Date,
): Cents {
  if (policy.mode === "NONE" || policy.value <= 0) return 0;
  // La mora por vencimiento del crédito no se reparte cuota por cuota: se
  // cobra una sola vez sobre todo el saldo, y la calcula `afterEndLateFee`.
  if (isAfterEndLateFee(policy.mode)) return 0;
  const step = policy.minorUnitStep ?? 1;
  if (installment.status === "PAID" || installment.status === "WAIVED")
    return 0;

  const lateDays = chargeableLateDays(
    installment.dueDate,
    asOf,
    policy.gracePeriodDays,
  );
  if (lateDays <= 0) return 0;

  const installmentTotal =
    installment.principalCents + installment.interestCents;
  const unpaid = clampToZero(installmentTotal - installment.paidCents);
  if (unpaid <= 0) return 0;

  let fee: Cents;
  switch (policy.mode) {
    case "PERCENT_OF_INSTALLMENT":
      fee = percentOf(unpaid, policy.value, step);
      break;
    case "PERCENT_PER_DAY":
      fee = percentOf(unpaid, policy.value, step) * lateDays;
      break;
    case "FIXED_PER_DAY":
      fee = roundToStep(policy.value, step) * lateDays;
      break;
    case "FIXED_ONCE":
      fee = roundToStep(policy.value, step);
      break;
    default:
      fee = 0;
  }

  const cap = policy.maxPercentOfInstallment ?? 0;
  if (cap > 0) {
    fee = Math.min(fee, percentOf(installmentTotal, cap, step));
  }
  return fee;
}

/**
 * La mora que corre por habérsele vencido el crédito al cliente.
 *
 * Es otra cosa que atrasarse en una cuota: aquí no importa cuántas cuotas
 * quedaron sin pagar por el camino, sino que llegó el día en que el préstamo
 * debía estar saldado y todavía se debe. Desde ese día empieza a correr, cada
 * día, sobre todo lo que quedó debiendo — el 2% del saldo, o los 2.000 de
 * siempre, como lo haya acordado quien presta.
 *
 * El porcentaje se saca de la deuda sin la mora encima. Sacado del saldo
 * completo la mora se cobraría a sí misma y crecería sola, que no es lo que
 * nadie acuerda en la puerta.
 */
export function afterEndLateFee(
  loan: {
    /** El día en que el préstamo debía estar saldado: la última cuota. */
    endDate: Date;
    /** Capital, interés y cargos que siguen debiéndose, sin contar la mora. */
    unpaidCents: Cents;
  },
  policy: LateFeePolicy,
  asOf: Date,
): Cents {
  if (!isAfterEndLateFee(policy.mode) || policy.value <= 0) return 0;
  if (loan.unpaidCents <= 0) return 0;

  const step = policy.minorUnitStep ?? 1;
  const lateDays = chargeableLateDays(
    loan.endDate,
    asOf,
    policy.gracePeriodDays,
  );
  if (lateDays <= 0) return 0;

  return policy.mode === "PERCENT_OF_BALANCE_PER_DAY_AFTER_END"
    ? percentOf(loan.unpaidCents, policy.value, step) * lateDays
    : roundToStep(policy.value, step) * lateDays;
}

/** Días corridos desde que se venció el crédito, ya descontada la gracia. */
export function daysAfterEnd(
  endDate: Date,
  asOf: Date,
  gracePeriodDays = 0,
): number {
  return chargeableLateDays(endDate, asOf, gracePeriodDays);
}

export interface ArrearsSummary {
  /** Days past due of the oldest unpaid installment. */
  daysInArrears: number;
  overdueInstallmentCount: number;
  overdueAmountCents: Cents;
  lateFeeCents: Cents;
  oldestOverdueDueDate: Date | null;
}

export function summarizeArrears(
  installments: InstallmentSnapshot[],
  policy: LateFeePolicy,
  asOf: Date = new Date(),
): ArrearsSummary {
  const today = startOfDay(asOf);
  let daysInArrears = 0;
  let overdueInstallmentCount = 0;
  let overdueAmountCents = 0;
  let lateFeeCents = 0;
  let oldestOverdueDueDate: Date | null = null;

  for (const installment of installments) {
    if (installment.status === "PAID" || installment.status === "WAIVED") {
      continue;
    }
    const overdueDays = daysOverdue(installment.dueDate, today);
    if (overdueDays <= 0) continue;

    const unpaid = clampToZero(
      installment.principalCents +
        installment.interestCents -
        installment.paidCents,
    );
    if (unpaid <= 0) continue;

    overdueInstallmentCount += 1;
    overdueAmountCents += unpaid;
    lateFeeCents += calculateLateFee(installment, policy, today);

    if (overdueDays > daysInArrears) {
      daysInArrears = overdueDays;
      oldestOverdueDueDate = startOfDay(installment.dueDate);
    }
  }

  return {
    daysInArrears,
    overdueInstallmentCount,
    overdueAmountCents,
    lateFeeCents,
    oldestOverdueDueDate,
  };
}
