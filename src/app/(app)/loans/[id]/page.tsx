import { notFound } from "next/navigation";
import Link from "next/link";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Icon,
  LinkButton,
  Select,
  StatCard,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import {
  MILLISECONDS_PER_DAY,
  addDays,
  dayIn,
  daysBetween,
  firstDueAfter,
  startOfDay,
} from "@/core/dates";
import { collectionSnapshot } from "@/core/loans/collection";
import { chargesOnDeliveryDay } from "@/server/services/first-due-fix";
import { canEditAtAll } from "@/core/loans/editable";
import { fromCents, toCents } from "@/core/money";
import type { LoanStatus } from "@/core/types";
import { formatDate, formatTime, initials } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { LOAN_ORDER } from "@/server/services/ordering";

import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { ShareDocument } from "@/components/ui/share-document";

import { DeletePaymentButton } from "../../payments/delete-payment-button";
import { HistoryMore } from "./history-more";
import { LoanCharges } from "./loan-charges";
import { LoanMenu } from "./loan-menu";
import { disburseLoanAction } from "../actions";
import { PaymentForm } from "./payment-form";
import { ShiftFirstDue } from "./shift-first-due";

export const dynamic = "force-dynamic";

/** Los dos botones para pasar de un préstamo a otro, del mismo tamaño. */
const STEP_LOAN =
  "flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-surface-muted text-sm font-medium text-ink transition-colors hover:bg-surface";

const LOAN_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  ACTIVE: "positive",
  IN_ARREARS: "danger",
  PAID: "brand",
  CANCELLED: "neutral",
  WRITTEN_OFF: "warning",
};

const INSTALLMENT_TONES: Record<string, Tone> = {
  PENDING: "neutral",
  PARTIALLY_PAID: "info",
  PAID: "positive",
  OVERDUE: "danger",
  WAIVED: "warning",
};

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("loans.read");
  const { id } = await params;

  const [loan, cashBoxes, applied, paymentCount, ordered, chargesApart] =
    await Promise.all([
      db.loan.findFirst({
        where: { id, companyId: context.companyId },
        include: {
          customer: true,
          guarantor: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              mobilePhone: true,
              photoUrl: true,
            },
          },
          installments: { orderBy: { number: "asc" } },
          payments: {
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            take: 50,
            include: { allocations: true },
          },
          // A refinance splits one debt across two loans; each has to say so or
          // the money looks like it came from nowhere and went nowhere.
          charges: { orderBy: { createdAt: "asc" } },
          parentLoan: { select: { id: true, code: true } },
          renewals: {
            where: { status: { not: "CANCELLED" } },
            select: { id: true, code: true },
            take: 1,
          },
        },
      }),
      db.cashBox.findMany({
        where: { companyId: context.companyId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      // El reparto de todo lo pagado, no solo de los recibos que se alcanzan a
      // ver: son las cuatro cifras que resumen para dónde se fue la plata.
      db.paymentAllocation.aggregate({
        where: { payment: { loanId: id, status: "POSTED" } },
        _sum: {
          principalAmount: true,
          interestAmount: true,
          chargeAmount: true,
          lateFeeAmount: true,
        },
      }),
      db.payment.count({ where: { loanId: id } }),
      // Los ids en el orden en que se ve la lista, para saber cuál sigue y cuál
      // va antes. Solo ids: es lo que hace falta y pesa nada.
      db.loan.findMany({
        where: { companyId: context.companyId },
        orderBy: LOAN_ORDER,
        select: { id: true },
        take: 1000,
      }),
      // Los cargos que se le cobraron al cliente aparte de la cuota. No son un
      // abono ni bajan lo que debe, así que no están entre los recibos; sin
      // esto no quedarían a la vista en ninguna parte de su préstamo.
      db.cashMovement.findMany({
        where: {
          loanId: id,
          kind: "CHARGE_COLLECTED",
          chargeName: { not: null },
        },
        select: { id: true, amount: true, chargeName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  if (!loan) notFound();

  const { t, money } = context;

  // Bajando una ruta uno va de un préstamo al siguiente; devolverse a la
  // lista cada vez son dos toques por cliente.
  const position = ordered.findIndex((row) => row.id === id);
  const previousLoan = position > 0 ? ordered[position - 1].id : null;
  const nextLoan =
    position >= 0 && position < ordered.length - 1
      ? ordered[position + 1].id
      : null;

  // Quién recibió cada abono. Payment guarda el id suelto, así que los
  // nombres se buscan de una vez para los recibos que se van a mostrar.
  const collectorIds = [
    ...new Set(
      loan.payments
        .map((payment) => payment.collectedById)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const collectors = new Map(
    collectorIds.length > 0
      ? (
          await db.user.findMany({
            where: { id: { in: collectorIds } },
            select: { id: true, fullName: true },
          })
        ).map((user) => [user.id, user.fullName])
      : [],
  );

  // Lo que se le abonó a cada cosa, en total.
  const appliedTiles = [
    {
      label: t("loans.principalPart"),
      value: Number(applied._sum.principalAmount ?? 0),
      tone: "text-ink",
    },
    {
      label: t("loans.interestPart"),
      value: Number(applied._sum.interestAmount ?? 0),
      tone: "text-brand-strong",
    },
    {
      label: t("loans.lateFeePart"),
      value: Number(applied._sum.lateFeeAmount ?? 0),
      tone: "text-danger",
    },
    {
      label: t("loans.charges.installmentPart"),
      value: Number(applied._sum.chargeAmount ?? 0),
      tone: "text-ink",
    },
  ];

  const rawPhone = loan.customer.mobilePhone ?? loan.customer.phone;
  const customerPhone = rawPhone ? rawPhone.replace(/\D/g, "") : null;
  const documentMessage = [
    context.companyName,
    `${t("loans.documentTitle")} ${loan.code}`,
    `${t("loans.principal")}: ${money(Number(loan.principal))}`,
    `${t("loans.totalToPay")}: ${money(
      Number(loan.totalPrincipal) + Number(loan.totalInterest),
    )}`,
  ].join("\n");

  // El atraso se cuenta al abrir la página, no cuando alguien cobró por
  // última vez: un préstamo que nadie ha tocado en una semana lleva esa semana
  // de atraso, aunque en la base todavía diga cero.
  const now = new Date();
  const today = startOfDay(now);
  const collect = collectionSnapshot(
    loan.installments.map((installment) => ({
      number: installment.number,
      dueDate: installment.dueDate,
      totalCents: toCents(Number(installment.totalAmount)),
      paidCents: toCents(Number(installment.paidAmount)),
      status: installment.status,
    })),
    now,
  );

  // Lo que se propone cobrar es la cuota entera — el número que el cliente
  // conoce — sin pasarse de lo que falta para saldar el préstamo.
  const outstandingCents = toCents(Number(loan.outstanding));
  const suggestedCents = Math.min(collect.installmentCents, outstandingCents);
  const suggestedAmount = fromCents(suggestedCents);

  const amountHint =
    suggestedCents <= 0
      ? undefined
      : collect.overdueCount > 0
        ? t(
            collect.overdueCount === 1
              ? "payments.amountOverdueOne"
              : "payments.amountOverdue",
          )
            .replace("{amount}", money(fromCents(collect.overdueCents)))
            .replace("{count}", String(collect.overdueCount))
        : suggestedCents < collect.installmentCents
          ? t("payments.amountRest").replace("{amount}", money(suggestedAmount))
          : t("payments.amountIsInstallment").replace(
              "{amount}",
              money(suggestedAmount),
            );

  // De un préstamo anulado o ya saldado no se cobra, y tampoco se atrasa:
  // las cuotas que le queden sin pagar no son mora de nadie.
  const openLoan = ["ACTIVE", "IN_ARREARS", "APPROVED"].includes(loan.status);
  // Cuotas atrasadas y días vencido: lo primero se cuenta en cuotas, lo
  // segundo en días desde que se acabó el plazo. Confundirlos era decirle al
  // cliente que lleva quince días vencido cuando el crédito se venció ayer.
  const overdueCount = openLoan ? collect.overdueCount : 0;
  const daysExpired = openLoan ? collect.daysExpired : 0;

  const canCollect = can(context, "payments.create") && openLoan;
  const canReverse = can(context, "payments.delete");

  // Una cuota que valga más que capital más interés sin decir por qué se lee
  // como una cuenta mal hecha, así que el cargo solo sale cuando lo hay.
  const hasFinancedCharge = loan.installments.some(
    (installment) => Number(installment.chargeAmount) > 0,
  );
  // Only an open loan with a balance can be carried onto another, and only
  // once: a second refinance would leave the customer owing the same money
  // twice. The service checks this again, since a URL can be typed by hand.
  const replacement = loan.renewals[0] ?? null;
  const canRenew =
    can(context, "loans.create") &&
    replacement === null &&
    Number(loan.outstanding) > 0 &&
    ["ACTIVE", "IN_ARREARS", "APPROVED"].includes(loan.status);

  // El préstamo empieza el día en que se entregó la plata; mientras no se
  // haya entregado, el día en que se creó.
  //
  // La entrega no es un día sino una hora exacta, y guardada en UTC un
  // préstamo entregado de noche en Colombia caía en el día siguiente: decía
  // que inició el 11 una plata que salió el 10. Por eso se baja primero al
  // día del reloj de la oficina, y solo entonces se compara con las cuotas,
  // que sí son días sueltos.
  //
  // Salvo cuando se pasó a la app un préstamo que ya venía andando en la
  // calle: ahí la fecha de entrega es el día en que se digitó y las cuotas
  // son de antes, y decir que "inició" después de su primera cuota — o
  // después de haberse acabado — no tiene sentido. La primera cuota manda.
  const registeredOn = dayIn(
    loan.disbursedAt ?? loan.createdAt,
    context.timezone,
  );
  // La primera por fecha, igual que la última: es el día en que empieza el
  // cobro, y es lo que explica cuándo se acaba.
  const firstDueDate = collect.firstDueDate ?? startOfDay(loan.firstDueDate);
  const openedOn = firstDueDate < registeredOn ? firstDueDate : registeredOn;
  // La última por fecha, no la última de la lista: así ninguna reordenada
  // puede volver el fin del crédito una fecha del medio.
  const lastDueDate = collect.lastDueDate;
  // Un préstamo saldado ya no vence: terminó el día en que se pagó — y ese
  // cierre también es una hora, así que va por el mismo camino.
  const endsOn = loan.closingDate
    ? dayIn(loan.closingDate, context.timezone)
    : lastDueDate;
  // Y pase lo que pase con los datos, empezar después de haber terminado no
  // se puede leer de ninguna manera.
  const startedOn = endsOn && endsOn < openedOn ? endsOn : openedOn;
  // Un préstamo de antes de la regla: la primera cuota cae el mismo día en
  // que salió la plata, así que se acaba un período antes de lo que debería.
  // Se ofrece correrlo, pero solo mientras el préstamo siga vivo y solo a
  // quien puede editarlo.
  const torcido = chargesOnDeliveryDay(
    {
      status: loan.status,
      disbursedAt: loan.disbursedAt,
      installments: [{ dueDate: firstDueDate }],
    },
    context.timezone,
  );
  const shiftedFirst = torcido
    ? firstDueAfter(loan.disbursedAt!, loan.frequency as never, {
        customIntervalDays: loan.customIntervalDays ?? undefined,
        nonCollectionDays: loan.nonCollectionDays,
      })
    : null;
  // A dónde se correría el final: las cuotas se mueven todas igual, así que
  // el último día se corre lo mismo que el primero.
  const shiftedEnd =
    shiftedFirst && lastDueDate
      ? addDays(
          lastDueDate,
          Math.round(
            (shiftedFirst.getTime() - firstDueDate.getTime()) /
              MILLISECONDS_PER_DAY,
          ),
        )
      : null;
  const canShift =
    torcido &&
    shiftedFirst !== null &&
    shiftedEnd !== null &&
    can(context, "loans.update") &&
    canEditAtAll(loan.status as LoanStatus);

  // La primera cuota solo se dice cuando no es el mismo día en que empezó:
  // repetir la fecha de arriba no le aclara nada a nadie.
  const showFirstDue =
    firstDueDate.getTime() !== startedOn.getTime() &&
    (!endsOn || firstDueDate < endsOn);

  // Lo vencido hasta hoy y la mora que se le ha sumado: dos cifras que solo
  // valen cuando existen, así que solo entonces ocupan una tarjeta.
  const catchUp = openLoan ? fromCents(collect.overdueCents) : 0;
  const lateFees = Number(loan.totalLateFees);
  const extraStats = (catchUp > 0 ? 1 : 0) + (lateFees > 0 ? 1 : 0);

  // La barra va por plata, no por cuotas: un abono a medias también avanza.
  const dueTotal =
    Number(loan.totalPrincipal) +
    Number(loan.totalInterest) +
    Number(loan.totalLateFees);
  const paidPercent =
    dueTotal > 0
      ? Math.min(100, Math.round((Number(loan.totalPaid) / dueTotal) * 100))
      : 0;

  const displayStatus =
    loan.status === "ACTIVE" && overdueCount > 0 ? "IN_ARREARS" : loan.status;

  return (
    <>
      {/* Arriba va el cliente, no el número del préstamo.
          En la puerta uno reconoce a la persona: la cara y el nombre son lo
          que dice si se está en la casa correcta. PRE-000007 no le dice nada
          a nadie, así que va debajo y pequeño. */}
      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3">
          {loan.customer.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={loan.customer.photoUrl}
              alt=""
              className="size-14 shrink-0 rounded-full object-cover ring-2 ring-brand-soft"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-subtle ring-2 ring-border">
              {initials(`${loan.customer.firstName} ${loan.customer.lastName}`)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-ink uppercase sm:text-xl">
              <Link
                href={`/customers/${loan.customer.id}`}
                className="hover:underline"
              >
                {loan.customer.firstName} {loan.customer.lastName}
              </Link>
            </h1>
            {/* La cédula: es lo que uno le pide al cliente para saber que es
                él, y lo que se copia para buscarlo en cualquier parte. El
                atraso y la mora los dicen las tarjetas de abajo, así que
                aquí no se repiten. */}
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
              <Icon
                name="credit-card"
                size={14}
                className="shrink-0 text-ink-subtle"
              />
              <span className="numeric truncate">
                {loan.customer.documentNumber ?? loan.customer.code}
              </span>
              {/* Un préstamo que no está corriendo — anulado, saldado, sin
                  desembolsar — no se nota en ninguna cifra, y confundirlo con
                  uno vivo es cobrar lo que no se debe cobrar. */}
              {displayStatus !== "ACTIVE" && displayStatus !== "IN_ARREARS" ? (
                <Badge tone={LOAN_TONES[displayStatus] ?? "neutral"}>
                  {t(`loans.status.${displayStatus}`)}
                </Badge>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 self-start">
            <LoanMenu
              loanId={loan.id}
              customerId={loan.customerId}
              phone={customerPhone}
              message={documentMessage}
              canCreate={can(context, "loans.create")}
              canRenew={canRenew}
              canEdit={
                can(context, "loans.update") &&
                canEditAtAll(loan.status as LoanStatus)
              }
              canDelete={can(context, "loans.delete")}
              // Sin cédula no hay con qué encontrarlo en otra oficina, así que
              // ofrecer reportarlo sería ofrecer algo que no va a servir.
              canReport={
                can(context, "credit.create") &&
                Boolean(loan.customer.documentNumber)
              }
            />
          </div>
        </div>

        {/* Bajando una ruta se pasa de un cliente al siguiente. Van abajo y de
            lado a lado: arriba, al lado del nombre, le quitaban la mitad del
            ancho y el nombre salía cortado. */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2.5">
          {previousLoan ? (
            <Link
              href={`/loans/${previousLoan}`}
              aria-label={t("loans.previousLoan")}
              className={STEP_LOAN}
            >
              <Icon name="chevron-left" size={18} />
              {t("loans.previousShort")}
            </Link>
          ) : (
            <span className={`${STEP_LOAN} opacity-40`} aria-hidden>
              <Icon name="chevron-left" size={18} />
              {t("loans.previousShort")}
            </span>
          )}
          {nextLoan ? (
            <Link
              href={`/loans/${nextLoan}`}
              aria-label={t("loans.nextLoan")}
              className={STEP_LOAN}
            >
              {t("loans.nextShort")}
              <Icon name="chevron-right" size={18} />
            </Link>
          ) : (
            <span className={`${STEP_LOAN} opacity-40`} aria-hidden>
              {t("loans.nextShort")}
              <Icon name="chevron-right" size={18} />
            </span>
          )}
        </div>
      </Card>

      {/* Ninguno de los dos préstamos se entiende solo: el viejo dice con qué
          quedó saldado y el nuevo de dónde viene el monto. */}
      {loan.parentLoan || replacement ? (
        <div className="mb-4 space-y-2">
          {loan.parentLoan ? (
            <Alert tone="info" icon="refresh">
              <Link
                href={`/loans/${loan.parentLoan.id}`}
                className="underline underline-offset-2"
              >
                {t("loans.renewal.comesFrom").replace(
                  "{code}",
                  loan.parentLoan.code,
                )}
              </Link>
            </Alert>
          ) : null}
          {replacement ? (
            <Alert tone="info" icon="refresh">
              <Link
                href={`/loans/${replacement.id}`}
                className="underline underline-offset-2"
              >
                {t("loans.renewal.replacedBy").replace(
                  "{code}",
                  replacement.code,
                )}
              </Link>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {loan.status === "DRAFT" && can(context, "loans.approve") ? (
        <form action={disburseLoanAction} className="mb-4">
          <input type="hidden" name="loanId" value={loan.id} />
          <Card>
            <CardBody className="flex flex-wrap items-end gap-3">
              {cashBoxes.length > 0 ? (
                <div className="min-w-48 flex-1">
                  <label
                    htmlFor="cashBoxId"
                    className="mb-1.5 block text-xs font-medium text-ink-muted"
                  >
                    {t("payments.cashBox")}
                  </label>
                  <Select id="cashBoxId" name="cashBoxId" defaultValue="">
                    <option value="">{t("common.none")}</option>
                    {cashBoxes.map((cashBox) => (
                      <option key={cashBox.id} value={cashBox.id}>
                        {cashBox.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <Button type="submit" icon="check">
                {t("loans.disburse")}
              </Button>
            </CardBody>
          </Card>
        </form>
      ) : null}

      {/* Con mora o con atraso son seis cifras y no caben en una fila de
          cuatro sin apretarse; en dos filas de tres se leen. */}
      <div
        className={`grid grid-cols-2 gap-3 ${
          extraStats > 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"
        }`}
      >
        <StatCard
          label={t("loans.principal")}
          value={money(Number(loan.principal))}
          hint={`${Number(loan.interestRate)}% ${t(
            `loans.rateBasisShort.${loan.rateBasis}`,
          )}`}
        />
        <StatCard
          label={t("loans.totalToPay")}
          value={money(
            Number(loan.totalPrincipal) +
              Number(loan.totalInterest) +
              Number(loan.totalLateFees),
          )}
          hint={`${t("loans.totalInterest")}: ${money(Number(loan.totalInterest))}`}
        />
        <StatCard
          label={t("loans.outstanding")}
          value={money(Number(loan.outstanding))}
          hint={`${t("loans.paidAmount")}: ${money(Number(loan.totalPaid))}`}
          tone="brand"
        />
        {/* Lo grande son las cuotas, que es lo que se atrasa. Debajo, si el
            plazo ya se acabó, cuántos días lleva vencido el crédito; si no,
            desde cuándo viene debiendo. */}
        <StatCard
          label={t("loans.overdueInstallments")}
          value={String(overdueCount)}
          hint={
            daysExpired > 0
              ? t(
                  daysExpired === 1
                    ? "loans.expiredDaysOne"
                    : "loans.expiredDays",
                ).replace("{days}", String(daysExpired))
              : !openLoan
                ? `${t("loans.lateFeePart")}: ${money(Number(loan.totalLateFees))}`
                : // Desde cuándo viene debiendo lo dice la tarjeta de al lado;
                  // aquí sirve más cuánto plazo le queda para arreglarlo.
                  collect.lastDueDate
                  ? t("loans.expiresOn").replace(
                      "{date}",
                      formatDate(collect.lastDueDate),
                    )
                  : t("loans.upToDate")
          }
          tone={overdueCount > 0 || daysExpired > 0 ? "danger" : "positive"}
          icon={
            overdueCount > 0 || daysExpired > 0 ? "alert-triangle" : "check"
          }
        />

        {/* Lo que tendría que pagar hoy para quedar al corriente: es el
            número que uno le dice en la puerta, y hasta ahora solo estaba
            chiquito debajo del campo de cobro. */}
        {catchUp > 0 ? (
          <StatCard
            label={t("loans.toCatchUp")}
            value={money(catchUp)}
            hint={
              collect.overdueSince
                ? t("loans.oldestOverdue").replace(
                    "{date}",
                    formatDate(collect.overdueSince),
                  )
                : undefined
            }
            tone="warning"
            icon="clock"
          />
        ) : null}

        {lateFees > 0 ? (
          <StatCard
            label={t("loans.lateFeeOwed")}
            value={money(lateFees)}
            hint={t(`loans.lateFeeModeLabel.${loan.lateFeeMode}`)}
            tone="danger"
            icon="alert-triangle"
          />
        ) : null}
      </div>

      {/* Lo que el cliente pregunta cuando abre la puerta: cuántas llevo,
          cuántas me faltan y cuánto he dado. */}
      {loan.installments.length > 0 ? (
        <Card className="mt-3 p-3">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              {
                label: t("loans.installmentsPaid"),
                value: `${collect.paidCount}/${loan.installments.length}`,
                tone: "text-positive",
              },
              {
                label: t("loans.installmentsLeft"),
                value: String(loan.installments.length - collect.paidCount),
                tone: "text-ink",
              },
              {
                label: t("loans.paidSoFar"),
                value: money(Number(loan.totalPaid)),
                tone: "text-brand",
              },
            ].map((tile) => (
              // En el teléfono "Cuotas pagadas" ocupa dos renglones y las
              // otras uno: los números se alinean abajo para que se lean en
              // fila y no escalonados.
              <div
                key={tile.label}
                className="flex h-full flex-col justify-between px-2 text-center"
              >
                <p className="text-[0.625rem] font-medium tracking-wide text-ink-muted uppercase">
                  {tile.label}
                </p>
                <p className={`numeric text-sm font-bold ${tile.tone}`}>
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-positive"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <span className="numeric text-[0.6875rem] font-semibold text-positive">
              {t("loans.paidPercent").replace("{percent}", String(paidPercent))}
            </span>
          </div>

          {/* De cuándo a cuándo va, en dos columnas: en una sola línea, con
              el rótulo delante de cada fecha, se salía del cuadro en el
              teléfono. El rótulo arriba y la fecha debajo caben siempre. */}
          <div className="mt-2 grid grid-cols-2 divide-x divide-border border-t border-border pt-2.5">
            <div className="px-2 text-center">
              <p className="text-[0.625rem] font-medium tracking-wide text-ink-muted uppercase">
                {t("loans.startLabel")}
              </p>
              <p className="numeric text-sm font-bold text-ink">
                {formatDate(startedOn)}
              </p>
              {/* El día en que empieza el cobro, debajo del día en que salió
                  la plata: sin él no se entiende por qué el crédito se acaba
                  el día que se acaba, y esa es justo la cuenta que la gente
                  hace de cabeza en la calle. */}
              {showFirstDue ? (
                <p className="numeric text-[0.625rem] text-ink-muted">
                  {t("loans.firstDueShort")} {formatDate(firstDueDate)}
                </p>
              ) : null}
            </div>
            <div className="px-2 text-center">
              <p className="text-[0.625rem] font-medium tracking-wide text-ink-muted uppercase">
                {t(loan.closingDate ? "loans.endedLabel" : "loans.endLabel")}
              </p>
              <p className="numeric text-sm font-bold text-ink">
                {endsOn ? formatDate(endsOn) : "—"}
              </p>
              {/* Cuántas cuotas caben entre las dos fechas: es lo que vuelve
                  comprobable el día del final en vez de pedir que se crea. */}
              <p className="numeric text-[0.625rem] text-ink-muted">
                {t("loans.installmentsOf")
                  .replace("{count}", String(loan.installments.length))
                  .replace(
                    "{frequency}",
                    t(`loans.frequencyLabel.${loan.frequency}`),
                  )}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* La tarjeta del cliente se fue: el nombre, la foto y la cédula ya
          están arriba, y para llamarlo o escribirle están los tres puntos.
          Repetirlo aquí era bajar dos pantallas para leer lo mismo. */}
      <div className="mt-4">
        {canCollect ? (
          <Card>
            <CardHeader title={t("payments.new")} />
            <CardBody>
              <PaymentForm
                loanId={loan.id}
                suggestedAmount={suggestedAmount}
                installmentAmount={fromCents(collect.installmentCents)}
                maxAmount={Number(loan.outstanding)}
                amountHint={amountHint}
                currencyCode={context.currencyCode}
                locale={context.locale}
                cashBoxes={cashBoxes.map((cashBox) => ({
                  id: cashBox.id,
                  label: cashBox.name,
                }))}
                decimalPlaces={context.decimalPlaces}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* El aviso va pegado a las dos fechas, que es donde se ve el
          problema: el crédito se acaba un día antes de lo que la cuenta de
          cabeza dice. */}
      {canShift ? (
        <div className="mt-4">
          <Card>
            <ShiftFirstDue
              loanId={loan.id}
              currentFirst={formatDate(firstDueDate)}
              proposedFirst={formatDate(shiftedFirst!)}
              currentEnd={endsOn ? formatDate(endsOn) : "—"}
              proposedEnd={formatDate(shiftedEnd!)}
            />
          </Card>
        </div>
      ) : null}

      {/* Quién respalda el préstamo. Con su enlace a la ficha: cuando el
          cliente deja de pagar, al fiador hay que poder llamarlo, y para eso
          hay que llegar a su teléfono en un toque. */}
      {loan.guarantor ? (
        <div className="mt-4">
          <Card>
            <CardHeader title={t("loans.guarantorOf")} />
            <CardBody>
              <Link
                href={`/customers/${loan.guarantor.id}`}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted">
                  {initials(
                    `${loan.guarantor.firstName} ${loan.guarantor.lastName}`,
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {loan.guarantor.firstName} {loan.guarantor.lastName}
                  </span>
                  <span className="numeric block text-xs text-ink-muted">
                    {loan.guarantor.code}
                    {loan.guarantor.mobilePhone
                      ? ` · ${loan.guarantor.mobilePhone}`
                      : ""}
                  </span>
                </span>
              </Link>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* Cada cargo lleva al lado su lápiz y su caneca, y abajo está el
          botón de agregar: las tres cosas se ven sin tener que buscarlas.
          Cambiar uno rehace el plan y mueve la caja: eso lo hace el
          servidor, no la tarjeta. */}
      <div className="mt-4">
        <LoanCharges
          loanId={loan.id}
          charges={loan.charges.map((charge) => ({
            id: charge.id,
            name: charge.name,
            amount: Number(charge.amount),
            mode: charge.mode,
          }))}
          principal={Number(loan.principal)}
          currencyCode={context.currencyCode}
          locale={context.locale}
          decimalPlaces={context.decimalPlaces}
          canEdit={
            can(context, "loans.update") &&
            canEditAtAll(loan.status as LoanStatus)
          }
        />
      </div>

      {/* Los cargos que se le cobraron aparte, con la fecha de cada uno. Esa
          plata ya entró a la caja y no baja lo que el cliente debe: va en su
          propia lista, no mezclada con los cargos del préstamo. */}
      {chargesApart.length > 0 ? (
        <div className="mt-4">
          <Card>
            <CardHeader
              title={t("loans.charges.apartTitle")}
              description={t("loans.charges.apartHint")}
            />
            <CardBody className="divide-y divide-border py-0">
              {chargesApart.map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {charge.chargeName}
                    </span>
                    <span className="numeric block text-xs text-ink-muted">
                      {/* Cobrado a una hora, no en un día suelto: se baja al
                          día de la oficina para que un cargo cobrado de
                          noche no aparezca con la fecha de mañana. */}
                      {formatDate(dayIn(charge.createdAt, context.timezone))}
                    </span>
                  </span>
                  <span className="numeric shrink-0 text-sm font-bold text-brand-strong">
                    {money(Number(charge.amount))}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      ) : null}

      <div className="mt-4">
        <Card>
          <CardHeader
            title={t("loans.documentTitle")}
            description={t("loans.documentHint")}
          />
          <CardBody>
            <ShareDocument
              url={`/api/loans/${loan.id}/pdf`}
              fileName={`${loan.code}.pdf`}
              mimeType="application/pdf"
              message={documentMessage}
              phone={customerPhone}
              shareLabel={t("loans.sharePdf")}
              downloadLabel={t("loans.downloadPdf")}
              busyLabel={t("payments.sharing")}
              fallbackLabel={t("payments.shareFallback")}
              downloadIcon="file-text"
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        <CollapsibleCard
          title={t("loans.schedule")}
          description={[
            t(`loans.method.${loan.interestMethod}`),
            loan.frequency === "CUSTOM" && loan.customIntervalDays
              ? `${t("loans.frequencyLabel.CUSTOM")} (${loan.customIntervalDays} días)`
              : t(`loans.frequencyLabel.${loan.frequency}`),
            loan.nonCollectionDays.length > 0
              ? `${t("loans.nonCollectionDays")}: ${loan.nonCollectionDays
                  .map((day) => t(`loans.weekday.${day}`))
                  .join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {loan.interestMethod === "CREDIT_LINE" ? (
            <CardBody className="pb-0">
              <Alert tone="info" icon="clock">
                {t("loans.openEndedNotice")}
              </Alert>
            </CardBody>
          ) : null}
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("loans.installment")}</Th>
                <Th>{t("loans.dueDate")}</Th>
                <Th align="right">{t("loans.principalPart")}</Th>
                <Th align="right">{t("loans.interestPart")}</Th>
                {hasFinancedCharge ? (
                  <Th align="right">{t("loans.charges.installmentPart")}</Th>
                ) : null}
                <Th align="right">{t("loans.lateFeePart")}</Th>
                <Th align="right">{t("loans.installmentTotal")}</Th>
                <Th align="right">{t("loans.paidAmount")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {loan.installments.map((installment) => {
                // Igual que arriba: la fila dice el atraso de hoy, no el del
                // día en que se registró el último cobro.
                const settled =
                  installment.status === "PAID" ||
                  installment.status === "WAIVED";
                const owed =
                  Number(installment.totalAmount) -
                  Number(installment.paidAmount);
                const lateDays =
                  !openLoan || settled || owed <= 0
                    ? 0
                    : Math.max(
                        0,
                        daysBetween(startOfDay(installment.dueDate), today),
                      );
                const status = lateDays > 0 ? "OVERDUE" : installment.status;

                return (
                  <tr key={installment.id}>
                    <Td numeric>{installment.number}</Td>
                    <Td numeric>{formatDate(installment.dueDate)}</Td>
                    <Td align="right" numeric>
                      {money(Number(installment.principalAmount))}
                    </Td>
                    <Td align="right" numeric>
                      {money(Number(installment.interestAmount))}
                    </Td>
                    {hasFinancedCharge ? (
                      <Td align="right" numeric>
                        {Number(installment.chargeAmount) > 0
                          ? money(Number(installment.chargeAmount))
                          : "—"}
                      </Td>
                    ) : null}
                    <Td align="right" numeric>
                      {Number(installment.lateFeeAmount) > 0
                        ? money(Number(installment.lateFeeAmount))
                        : "—"}
                    </Td>
                    <Td align="right" numeric className="font-medium">
                      {money(Number(installment.totalAmount))}
                    </Td>
                    <Td align="right" numeric>
                      {money(Number(installment.paidAmount))}
                    </Td>
                    <Td align="center">
                      <Badge tone={INSTALLMENT_TONES[status] ?? "neutral"}>
                        {t(`loans.installmentStatus.${status}`)}
                      </Badge>
                      {lateDays > 0 ? (
                        <span className="mt-0.5 block text-xs font-medium text-danger">
                          {lateDays === 1
                            ? t("loans.installmentLateOne")
                            : t("loans.installmentLate").replace(
                                "{days}",
                                String(lateDays),
                              )}
                        </span>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </CollapsibleCard>

        <Card>
          <CardHeader title={t("payments.historyTitle")} />
          {loan.payments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-muted">
                {t("payments.emptyHint")}
              </p>
            </CardBody>
          ) : (
            <>
              {/* Para dónde se fue todo lo que el cliente ha pagado. Es la
                pregunta que sigue a "¿cuánto he pagado?": si abonó 400.000 y
                el saldo bajó 300.000, los otros 100.000 están aquí. */}
              <div className="grid grid-cols-4 divide-x divide-border border-b border-border px-3 py-2.5">
                {appliedTiles.map((tile) => (
                  <div key={tile.label} className="px-1 text-center">
                    <p className="text-[0.625rem] font-medium tracking-wide text-ink-muted uppercase">
                      {tile.label}
                    </p>
                    <p className={`numeric text-sm font-bold ${tile.tone}`}>
                      {money(tile.value)}
                    </p>
                  </div>
                ))}
              </div>

              <TableWrap>
                <thead>
                  <tr>
                    <Th>{t("payments.paidAt")}</Th>
                    <Th>{t("payments.method")}</Th>
                    <Th align="right">{t("common.amount")}</Th>
                    <Th align="right">{t("loans.balanceAfter")}</Th>
                    {canReverse ? <Th align="right">{""}</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = loan.payments.map((payment, index) => {
                      // El saldo con el que quedó el cliente ese día: lo que debe
                      // hoy más todo lo que abonó después. Los recibos vienen del
                      // más nuevo al más viejo, así que "después" son los de
                      // arriba. Un recibo anulado no movió el saldo.
                      const laterPaid = loan.payments
                        .slice(0, index)
                        .filter((other) => other.status === "POSTED")
                        .reduce(
                          (total, other) => total + Number(other.amount),
                          0,
                        );
                      const balanceAfter = Number(loan.outstanding) + laterPaid;

                      const split = payment.allocations.reduce(
                        (parts, allocation) => ({
                          principal:
                            parts.principal +
                            Number(allocation.principalAmount),
                          interest:
                            parts.interest + Number(allocation.interestAmount),
                          lateFee:
                            parts.lateFee + Number(allocation.lateFeeAmount),
                          charge:
                            parts.charge + Number(allocation.chargeAmount),
                        }),
                        { principal: 0, interest: 0, lateFee: 0, charge: 0 },
                      );
                      const splitText = [
                        split.principal > 0
                          ? `${t("loans.principalPart")} ${money(split.principal)}`
                          : null,
                        split.interest > 0
                          ? `${t("loans.interestPart")} ${money(split.interest)}`
                          : null,
                        split.lateFee > 0
                          ? `${t("loans.lateFeePart")} ${money(split.lateFee)}`
                          : null,
                        split.charge > 0
                          ? `${t("loans.charges.installmentPart")} ${money(
                              split.charge,
                            )}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const collector = payment.collectedById
                        ? collectors.get(payment.collectedById)
                        : null;
                      const posted = payment.status === "POSTED";

                      return (
                        <tr key={payment.id}>
                          {/* El día que se cobró y la hora en que quedó
                            registrado; el recibo se abre desde aquí, que era
                            lo único que hacía falta de su número. */}
                          <Td numeric>
                            <Link
                              href={`/payments/${payment.id}`}
                              className="font-medium text-brand-strong hover:underline"
                            >
                              {formatDate(payment.paidAt)}
                            </Link>{" "}
                            <span className="numeric text-ink-muted">
                              {formatTime(
                                payment.createdAt,
                                context.locale,
                                context.timezone,
                              )}
                            </span>
                            {collector ? (
                              <span className="mt-0.5 block text-[0.6875rem] text-ink-subtle">
                                {t("payments.collectedByShort").replace(
                                  "{name}",
                                  collector,
                                )}
                              </span>
                            ) : null}
                          </Td>
                          <Td>{t(`payments.methodLabel.${payment.method}`)}</Td>
                          <Td align="right" numeric>
                            {/* Un abono anulado no entró: sin la columna de
                              estado, se nota tachado. */}
                            <span
                              className={
                                posted
                                  ? "font-medium"
                                  : "text-ink-subtle line-through"
                              }
                            >
                              {money(Number(payment.amount))}
                            </span>
                            {!posted ? (
                              <span className="mt-0.5 block text-[0.6875rem] font-medium text-danger">
                                {t(`payments.statusLabel.${payment.status}`)}
                              </span>
                            ) : null}
                            {splitText ? (
                              <span className="numeric mt-0.5 block text-[0.6875rem] text-ink-subtle">
                                {splitText}
                              </span>
                            ) : null}
                          </Td>
                          <Td align="right" numeric className="text-ink-muted">
                            {posted ? money(balanceAfter) : "—"}
                          </Td>
                          {canReverse ? (
                            <Td align="right">
                              {/* El recibo de una refinanciación no se toca desde
                            aquí: devolvería el saldo dejando vivo el préstamo
                            que se lo llevó, y el cliente quedaría debiendo dos
                            veces lo mismo. Se deshace anulando ese préstamo. */}
                              {payment.method === "REFINANCE" ? null : (
                                <span className="flex items-center justify-end gap-0.5">
                                  <LinkButton
                                    href={`/payments/${payment.id}`}
                                    variant="ghost"
                                    size="sm"
                                    icon="pencil"
                                    aria-label={t("payments.edit")}
                                  />
                                  <DeletePaymentButton paymentId={payment.id} />
                                </span>
                              )}
                            </Td>
                          ) : null}
                        </tr>
                      );
                    });

                    // Los tres últimos a la vista; los demás detrás de la
                    // línea, que es lo que se abre cuando el cliente reclama
                    // algo viejo.
                    const shown = rows.slice(0, 3);
                    const rest = rows.slice(3);
                    if (rest.length === 0) return shown;

                    return (
                      <>
                        {shown}
                        <HistoryMore
                          columns={canReverse ? 5 : 4}
                          hidden={rest.length}
                        >
                          {rest}
                        </HistoryMore>
                      </>
                    );
                  })()}
                </tbody>
              </TableWrap>
            </>
          )}
          {paymentCount > loan.payments.length ? (
            <CardBody className="pt-0">
              <p className="text-xs text-ink-subtle">
                {t("payments.showingLast")
                  .replace("{shown}", String(loan.payments.length))
                  .replace("{total}", String(paymentCount))}
              </p>
            </CardBody>
          ) : null}
        </Card>
      </div>
    </>
  );
}
