/**
 * Lo que hay que cobrarle a un préstamo hoy.
 *
 * No es el saldo. El saldo es todo lo que el cliente debe hasta el final —
 * 1.200.000 — y lo que el cobrador le pide en la puerta es la cuota:
 * 40.000, o lo que se haya acumulado si viene atrasado. Confundir los dos es
 * cobrar de más o de menos, así que van separados y con nombre distinto.
 */

import { clampToZero, type Cents } from "../money";

export interface CollectableInstallment {
  number: number;
  dueDate: Date;
  /** Cuota completa: capital, interés, cargo y mora. */
  totalCents: Cents;
  paidCents: Cents;
  status: string;
}

export type DueKind = "overdue" | "upcoming" | "settled";

export interface CollectionSnapshot {
  /** Cuotas ya pagadas, para el "12/30". */
  paidCount: number;
  /** Lo que debería estar pagado y no lo está. Cero si viene al día. */
  overdueCents: Cents;
  /** La próxima cuota que toca, esté vencida o no. */
  nextDueDate: Date | null;
  nextAmountCents: Cents;
  /**
   * Qué enseñar en grande: lo vencido si lo hay, si no la próxima cuota, y
   * nada cuando ya no queda nada por cobrar.
   */
  kind: DueKind;
  amountCents: Cents;
}

const SETTLED = new Set(["PAID", "WAIVED"]);

export function collectionSnapshot(
  installments: readonly CollectableInstallment[],
  asOf: Date = new Date(),
): CollectionSnapshot {
  const open = [...installments]
    .filter((installment) => !SETTLED.has(installment.status))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const paidCount = installments.length - open.length;

  const overdueCents = open
    .filter((installment) => installment.dueDate <= asOf)
    .reduce(
      (total, installment) =>
        total + clampToZero(installment.totalCents - installment.paidCents),
      0,
    );

  const next = open[0] ?? null;
  const nextAmountCents = next
    ? clampToZero(next.totalCents - next.paidCents)
    : 0;

  if (open.length === 0) {
    return {
      paidCount,
      overdueCents: 0,
      nextDueDate: null,
      nextAmountCents: 0,
      kind: "settled",
      amountCents: 0,
    };
  }

  return {
    paidCount,
    overdueCents,
    nextDueDate: next?.dueDate ?? null,
    nextAmountCents,
    kind: overdueCents > 0 ? "overdue" : "upcoming",
    amountCents: overdueCents > 0 ? overdueCents : nextAmountCents,
  };
}
