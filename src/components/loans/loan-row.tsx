import Link from "next/link";

import { Badge, Card, type Tone } from "@/components/ui";
import { collectionSnapshot } from "@/core/loans/collection";
import { startOfDay } from "@/core/dates";
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
  if (status === "WRITTEN_OFF") {
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
  payments: ReadonlyArray<{ paidAt: Date; amount: unknown }>;
};

export function LoanRow({
  loan,
  today,
  t,
  money,
  locale,
  title,
  sortableId,
  searchText,
}: {
  loan: LoanRowLoan;
  /**
   * El día de hoy donde está la empresa.
   *
   * Obligatorio y por props, no sacado de la hora del servidor aquí: de eso
   * dependen el atraso, el «cobrar hoy» y el resaltado del que ya abonó, y el
   * servidor puede estar en otro huso. Con la hora del servidor, a las siete
   * de la noche en Colombia ya era mañana y aparecía atrasada una cuota que
   * todavía no vencía.
   */
  today: Date;
  t: (key: string) => string;
  money: (value: number) => string;
  locale?: string;
  /**
   * El nombre del cliente en la lista general. En su propia ficha se omite:
   * repetirlo en cada tarjeta no dice nada nuevo.
   */
  title?: string;
  sortableId?: string;
  /** Con qué se encuentra esta tarjeta buscando en vivo. */
  searchText?: string;
}) {
  const snapshot = collectionSnapshot(
    loan.installments.map((installment) => ({
      number: installment.number,
      dueDate: installment.dueDate,
      totalCents: toCents(Number(installment.totalAmount)),
      paidCents: toCents(Number(installment.paidAmount)),
      status: installment.status,
    })),
    today,
  );
  const lastPayment = loan.payments[0]?.paidAt ?? null;
  /**
   * Si el cliente ya abonó hoy.
   *
   * Es lo que el cobrador necesita ver de un vistazo cuando vuelve a abrir la
   * lista a media tarde: sin esto hay que leer la fecha del último pago
   * tarjeta por tarjeta, y se toca dos veces la misma puerta.
   */
  const paidToday =
    lastPayment !== null &&
    startOfDay(lastPayment).getTime() === today.getTime();
  const paidTodayAmount = paidToday ? Number(loan.payments[0]?.amount ?? 0) : 0;
  // Un préstamo anulado conserva sus cuotas sin pagar, así que el cálculo por
  // sí solo pediría cobrarlas. De un anulado no se cobra.
  const collectable =
    COLLECTABLE.has(loan.status) && snapshot.kind !== "settled";
  // El atraso se cuenta al abrir la lista: un préstamo que nadie ha tocado en
  // una semana ya lleva esa semana, diga lo que diga la columna guardada.
  const overdueCount = collectable ? snapshot.overdueCount : 0;
  /**
   * Cuántas cuotas son los pesos del «Cobrar hoy», la de hoy incluida.
   *
   * Va aparte de `overdueCount` —que es el atraso de verdad y decide el color
   * y la etiqueta— porque este número se lee pegado a la plata, y contando
   * solo las que ya pasaron de fecha la tarjeta decía «3 cuotas atrasadas»
   * encima de un «Cobrar hoy» de cuatro cuotas. Es la misma regla de la ficha
   * del préstamo: el conteo y el dinero salen de las mismas cuotas.
   */
  const dueNowCount = collectable ? snapshot.dueNowCount : 0;
  const daysExpired = collectable ? snapshot.daysExpired : 0;
  const status =
    loan.status === "ACTIVE" && overdueCount > 0 ? "IN_ARREARS" : loan.status;

  /**
   * Lo que dice la etiqueta de la esquina.
   *
   * Decía «En mora» a todo el que debiera una cuota, con lo que un préstamo
   * al que se le pasó el plazo entero y otro con una cuota de ayer se veían
   * igual. Ahora dice lo mismo que los filtros de arriba —vencido, atrasado,
   * al día— y son las tres cosas distintas que se hacen con un préstamo.
   *
   * Un borrador o un saldado conservan su propio nombre: no están en cobro y
   * llamarlos «al día» sería decir que están corriendo bien.
   */
  const stateLabel = !collectable
    ? t(`loans.status.${status}`)
    : daysExpired > 0
      ? // Con los días adentro. Al lado de un renglón que ya decía «Vencido
        // 8 d», la etiqueta repetía la palabra y ese pedazo de más partía el
        // renglón en dos: la tarjeta más urgente era la más alta de la lista.
        t(
          daysExpired === 1
            ? "loans.cardExpiredDaysOne"
            : "loans.cardExpiredDays",
        ).replace("{days}", String(daysExpired))
      : overdueCount > 0
        ? t("loans.cardLate")
        : t("loans.cardOnTime");
  const stateTone: Tone = !collectable
    ? (STATUS_TONES[status] ?? "neutral")
    : daysExpired > 0
      ? "danger"
      : overdueCount > 0
        ? "warning"
        : "positive";
  const dueLabel =
    snapshot.kind === "overdue"
      ? t("loans.collectNow")
      : snapshot.kind === "upcoming"
        ? t("loans.nextInstallment")
        : t("loans.nothingDue");

  return (
    <Card
      sortableId={sortableId}
      searchText={searchText}
      className={`overflow-hidden border-l-4 ${severity(
        loan.status,
        overdueCount,
        daysExpired,
      )} ${paidToday ? "bg-positive-soft/40" : ""}`}
    >
      <Link
        href={`/loans/${loan.id}`}
        className="block px-3 py-2 transition-colors hover:bg-surface-muted"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="numeric text-[0.6875rem] leading-snug text-ink-muted">
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
                  dueNowCount === 1
                    ? "loans.overdueCountShortOne"
                    : "loans.overdueCountShort",
                ).replace("{count}", String(dueNowCount))}
              </span>
            ) : null}
          </span>
          <Badge tone={stateTone} className="shrink-0 text-[0.6875rem]">
            {stateLabel}
          </Badge>
        </span>

        {title ? (
          <span className="block truncate text-sm leading-snug font-bold text-ink">
            {title}
          </span>
        ) : null}

        <span className="numeric block truncate text-[0.6875rem] leading-snug text-ink-subtle">
          {/* Abonó hoy se dice aquí y no en un renglón nuevo: es el mismo
              dato —cuándo pagó por última vez— y una tarjeta que crece por
              cada cliente que paga deja menos clientes en pantalla justo el
              día en que más se está cobrando. */}
          {paidToday ? (
            <span className="font-semibold text-positive">
              {t("loans.paidTodayShort").replace(
                "{amount}",
                money(paidTodayAmount),
              )}
            </span>
          ) : (
            <>
              {t("loans.lastPayment")}{" "}
              {lastPayment
                ? formatDate(lastPayment, locale)
                : t("loans.noPayments")}
            </>
          )}
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
          <span className="numeric text-[0.6875rem] text-ink-muted">
            {t("loans.outstanding")}{" "}
            <span className="font-semibold text-ink">
              {money(Number(loan.outstanding))}
            </span>
          </span>
          {collectable ? (
            <span
              className={
                "flex shrink-0 flex-col items-end rounded-lg px-2.5 py-0.5 " +
                (snapshot.kind === "overdue"
                  ? "bg-danger-soft"
                  : "bg-brand-soft")
              }
            >
              <span className="text-[0.5625rem] font-medium tracking-wide text-ink-muted uppercase">
                {dueLabel}
              </span>
              <span
                className={
                  "numeric text-sm leading-tight font-bold " +
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
