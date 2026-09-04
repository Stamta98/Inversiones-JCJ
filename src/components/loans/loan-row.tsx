import Link from "next/link";

import { Badge, Card, type Tone } from "@/components/ui";
import { collectionSnapshot } from "@/core/loans/collection";
import { fromCents, toCents } from "@/core/money";
import { formatDate } from "@/lib/format";

/**
 * Un préstamo, como se ve en una lista.
 *
 * La misma tarjeta en la lista de préstamos y en la ficha del cliente: en la
 * ficha era una tabla de cuatro columnas que en el teléfono se salía por la
 * derecha, y el cobrador no alcanzaba a ver el saldo sin arrastrarla. Una
 * tarjeta cabe, y dice lo mismo con más: cuántas cuotas van, cuántas están
 * atrasadas y cuánto hay que pedir hoy.
 */

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  ACTIVE: "positive",
  IN_ARREARS: "danger",
  PAID: "brand",
  CANCELLED: "neutral",
  WRITTEN_OFF: "warning",
};

const COLLECTABLE = new Set(["ACTIVE", "IN_ARREARS", "APPROVED"]);

/** La raya de la izquierda: de un vistazo, cómo va el préstamo. */
function severity(
  status: string,
  overdueCount: number,
  daysExpired: number,
): string {
  if (status === "PAID") return "border-l-brand";
  if (status === "CANCELLED" || status === "WRITTEN_OFF") {
    return "border-l-border-strong";
  }
  if (daysExpired > 0) return "border-l-danger";
  if (overdueCount > 0) return "border-l-warning";
  return "border-l-positive";
}

export type LoanRowLoan = {
  id: string;
  code: string;
  status: string;
  frequency: string;
  outstanding: unknown;
  installments: ReadonlyArray<{
    number: number;
    dueDate: Date;
    totalAmount: unknown;
    paidAmount: unknown;
    status: string;
  }>;
  payments: ReadonlyArray<{ paidAt: Date }>;
};

export function LoanRow({
  loan,
  now,
  t,
  money,
  locale,
  title,
  sortableId,
}: {
  loan: LoanRowLoan;
  now: Date;
  t: (key: string) => string;
  money: (value: number) => string;
  locale?: string;
  /**
   * El nombre del cliente en la lista general. En su propia ficha se omite:
   * repetirlo en cada tarjeta no dice nada nuevo.
   */
  title?: string;
  sortableId?: string;
}) {
  const snapshot = collectionSnapshot(
    loan.installments.map((installment) => ({
      number: installment.number,
      dueDate: installment.dueDate,
      totalCents: toCents(Number(installment.totalAmount)),
      paidCents: toCents(Number(installment.paidAmount)),
      status: installment.status,
    })),
    now,
  );
  const lastPayment = loan.payments[0]?.paidAt ?? null;
  // Un préstamo anulado conserva sus cuotas sin pagar, así que el cálculo por
  // sí solo pediría cobrarlas. De un anulado no se cobra.
  const collectable =
    COLLECTABLE.has(loan.status) && snapshot.kind !== "settled";
  // El atraso se cuenta al abrir la lista: un préstamo que nadie ha tocado en
  // una semana ya lleva esa semana, diga lo que diga la columna guardada.
  const overdueCount = collectable ? snapshot.overdueCount : 0;
  const daysExpired = collectable ? snapshot.daysExpired : 0;
  const status =
    loan.status === "ACTIVE" && overdueCount > 0 ? "IN_ARREARS" : loan.status;
  const dueLabel =
    snapshot.kind === "overdue"
      ? t("loans.collectNow")
      : snapshot.kind === "upcoming"
        ? t("loans.nextInstallment")
        : t("loans.nothingDue");

  return (
    <Card
      sortableId={sortableId}
      className={`overflow-hidden border-l-4 ${severity(loan.status, overdueCount, daysExpired)}`}
    >
      <Link
        href={`/loans/${loan.id}`}
        className="block px-3 py-2.5 transition-colors hover:bg-surface-muted"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="numeric text-xs text-ink-muted">
            <span className="font-semibold text-brand-strong">
              #{loan.code.replace(/^\D+0*/, "")}
            </span>
            {" · "}
            {t(`loans.frequencyLabel.${loan.frequency}`)}
            {" · "}
            <span className="font-semibold text-ink">
              {snapshot.paidCount}/{loan.installments.length}
            </span>
            {overdueCount > 0 ? (
              <span className="font-semibold text-danger">
                {" · "}
                {t(
                  overdueCount === 1
                    ? "loans.overdueCountShortOne"
                    : "loans.overdueCountShort",
                ).replace("{count}", String(overdueCount))}
              </span>
            ) : null}
            {daysExpired > 0 ? (
              <span className="font-semibold text-danger">
                {" · "}
                {t("loans.expiredShort").replace("{days}", String(daysExpired))}
              </span>
            ) : null}
          </span>
          <Badge tone={STATUS_TONES[status] ?? "neutral"}>
            {t(`loans.status.${status}`)}
          </Badge>
        </span>

        {title ? (
          <span className="block truncate text-[0.9375rem] leading-snug font-bold text-ink">
            {title}
          </span>
        ) : null}

        <span className="numeric block truncate text-xs leading-snug text-ink-subtle">
          {t("loans.lastPayment")}{" "}
          {lastPayment
            ? formatDate(lastPayment, locale)
            : t("loans.noPayments")}
          {snapshot.nextDueDate ? (
            <>
              {" · "}
              {t("loans.nextInstallment")}{" "}
              <span className="font-medium text-ink-muted">
                {formatDate(snapshot.nextDueDate, locale)}
              </span>
            </>
          ) : null}
        </span>

        {/* Lo que se le pide en la puerta, aparte del saldo: son números
            distintos y confundirlos es cobrar mal. */}
        <span className="mt-1 flex items-center justify-between gap-3">
          <span className="numeric text-xs text-ink-muted">
            {t("loans.outstanding")}{" "}
            <span className="font-semibold text-ink">
              {money(Number(loan.outstanding))}
            </span>
          </span>
          {collectable ? (
            <span
              className={
                "flex shrink-0 flex-col items-end rounded-lg px-2.5 py-0.5 " +
                (snapshot.kind === "overdue" ? "bg-danger-soft" : "bg-brand-soft")
              }
            >
              <span className="text-[0.5625rem] font-medium tracking-wide text-ink-muted uppercase">
                {dueLabel}
              </span>
              <span
                className={
                  "numeric text-base leading-tight font-bold " +
                  (snapshot.kind === "overdue"
                    ? "text-danger"
                    : "text-brand-strong")
                }
              >
                {money(fromCents(snapshot.amountCents))}
              </span>
            </span>
          ) : null}
        </span>
      </Link>
    </Card>
  );
}
