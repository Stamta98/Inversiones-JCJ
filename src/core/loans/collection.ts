/**
 * Lo que hay que cobrarle a un préstamo hoy.
 *
 * No es el saldo. El saldo es todo lo que el cliente debe hasta el final —
 * 1.200.000 — y lo que el cobrador le pide en la puerta es la cuota:
 * 40.000, o lo que se haya acumulado si viene atrasado. Confundir los dos es
 * cobrar de más o de menos, así que van separados y con nombre distinto.
 */

import { daysBetween, startOfDay } from "../dates";
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
  /**
   * Cuántas cuotas se quedaron atrás y desde cuándo, contando solo las que ya
   * pasaron de fecha: la que vence hoy todavía se puede cobrar hoy, así que
   * entra en lo que hay que cobrar pero no en el atraso.
   */
  overdueCount: number;
  daysLate: number;
  overdueSince: Date | null;
  /**
   * El día en que el crédito se acaba — la última cuota — y cuántos días lleva
   * vencido desde ese día.
   *
   * Es otra cosa que el atraso: un cliente puede llevar veinte cuotas
   * atrasadas y que el crédito todavía no se venza, y puede vencerse ayer y
   * llevar un solo día vencido. Lo que se atrasa son cuotas; lo que se vence
   * es el crédito.
   */
  lastDueDate: Date | null;
  daysExpired: number;
  /** La próxima cuota que toca, esté vencida o no. */
  nextDueDate: Date | null;
  nextAmountCents: Cents;
  /**
   * La cuota completa, sin descontar lo que ya se abonó a ella. Es el número
   * que el cliente conoce — "yo pago cuatro mil" — y por eso es el que se
   * propone al cobrar, aunque quede debiendo menos.
   */
  installmentCents: Cents;
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

  const today = startOfDay(asOf);
  const lastDueDate = installments.reduce<Date | null>(
    (last, installment) =>
      last === null || installment.dueDate > last
        ? startOfDay(installment.dueDate)
        : last,
    null,
  );
  const late = open.filter(
    (installment) =>
      startOfDay(installment.dueDate) < today &&
      clampToZero(installment.totalCents - installment.paidCents) > 0,
  );
  const overdueSince = late[0] ? startOfDay(late[0].dueDate) : null;

  if (open.length === 0) {
    return {
      paidCount,
      overdueCents: 0,
      overdueCount: 0,
      daysLate: 0,
      overdueSince: null,
      lastDueDate,
      daysExpired: 0,
      nextDueDate: null,
      nextAmountCents: 0,
      installmentCents: 0,
      kind: "settled",
      amountCents: 0,
    };
  }

  return {
    paidCount,
    overdueCents,
    overdueCount: late.length,
    daysLate: overdueSince ? daysBetween(overdueSince, today) : 0,
    overdueSince,
    lastDueDate,
    // Solo cuenta mientras quede algo por cobrar: un crédito saldado no se
    // vence, se acabó.
    daysExpired:
      lastDueDate && lastDueDate < today ? daysBetween(lastDueDate, today) : 0,
    nextDueDate: next?.dueDate ?? null,
    nextAmountCents,
    installmentCents: next?.totalCents ?? 0,
    kind: overdueCents > 0 ? "overdue" : "upcoming",
    amountCents: overdueCents > 0 ? overdueCents : nextAmountCents,
  };
}
