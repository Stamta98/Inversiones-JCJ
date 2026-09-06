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
        select: {
          id: true,
          amount: true,
          chargeName: true,
          createdAt: true,
          createdById: true,
        },
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
      [
        ...loan.payments.map((payment) => payment.collectedById),
        // Un cargo cobrado aparte también lo recibió alguien, y va en el
        // mismo historial: sin su nombre el renglón sale sin dueño.
        ...chargesApart.map((charge) => charge.createdById),
      ].filter((id): id is string => Boolean(id)),
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
    // El cargo cobrado en la puerta no entró a ninguna cuota, así que no está
    // en ninguno de los cuatro de arriba. Sin este recuadro los renglones del
    // historial sumaban más de lo que los recuadros decían.
    ...(chargesApart.length > 0
      ? [
          {
            label: t("payments.summary.chargeApart"),
            value: chargesApart.reduce(
              (total, charge) => total + Number(charge.amount),
              0,
            ),
            tone: "text-positive",
          },
        ]
      : []),
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
  // Los cargos anotados que todavía se le deben, con lo que le falta a cada
  // uno: es lo único que se puede cobrar aparte. Uno ya completo sale de la
  // lista solo, sin tener que borrarlo del préstamo.
  const pendingCharges = loan.charges
    .filter((charge) => charge.mode === "PENDING")
    .map((charge) => ({
      id: charge.id,
      name: charge.name,
      left: Number(charge.amount) - Number(charge.paidAmount),
    }))
    .filter((charge) => charge.left > 0);

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
  // Cuántas cuotas ya pasaron de fecha. Sirve para decir «13 de 26» en vez de
  // un 13 suelto: trece atrasadas de catorce que van corridas es un préstamo
  // perdido, y de cien es uno que apenas tropezó.
  // El cargo que se reparte entre las cuotas. No está en «totalPrincipal» ni
  // en «totalInterest», así que el total lo dejaba por fuera: un préstamo de
  // 200.000 con 10.000 de cargo decía «Total a pagar 240.000» cuando el
  // cliente debía 250.000. Se lee de las cuotas, que es donde de verdad está.
  const financedCharges = loan.installments.reduce(
    (total, installment) => total + Number(installment.chargeAmount),
    0,
  );

  const dueSoFar = loan.installments.filter(
    (installment) => installment.dueDate.getTime() < today.getTime(),
  ).length;
  const lateFees = Number(loan.totalLateFees);

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

  // Los renglones de la cuenta y su total, armados de una vez: el total es la
  // suma de lo que se ve, no otra cuenta por su lado que pueda decir algo
  // distinto de lo que está escrito encima.
  const accountRows = [
    { label: t("loans.principal"), value: Number(loan.totalPrincipal) },
    {
      label: t("loans.interestOf")
        .replace("{rate}", String(Number(loan.interestRate)))
        .replace("{basis}", t(`loans.rateBasisShort.${loan.rateBasis}`)),
      value: Number(loan.totalInterest),
    },
    { label: t("loans.charges.installmentPart"), value: financedCharges },
    // Solo los que pesan: un renglón en cero le hace creer al cliente que se
    // le está cobrando algo que no se le cobra.
    { label: t("loans.lateFeeOwed"), value: lateFees },
  ].filter((row) => row.value > 0);
  const totalToPay = accountRows.reduce((total, row) => total + row.value, 0);

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
                  {/* Viene con la primera caja puesta, igual que el
                      formulario de crear. Con "Ninguno" por delante, entregar
                      un préstamo guardado en borrador sacaba la plata sin que
                      la caja se enterara: ni el desembolso ni el cargo salían
                      en el resumen del día. */}
                  <Select
                    id="cashBoxId"
                    name="cashBoxId"
                    defaultValue={cashBoxes[0]?.id ?? ""}
                  >
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

      {/* Todo lo del crédito en un solo cuadro, de arriba abajo: lo que se
          prestó, en qué quedó el trato, cómo va y qué se atrasó. Repartido en
          cuadritos sueltos, cada cifra se leía sola y de dónde salía el saldo
          había que adivinarlo; en renglones, la cuenta se sigue con el dedo y
          el cliente la puede comprobar en la puerta. */}
      <Card className="mt-3">
        <CardHeader
          title={t("loans.detailsTitle")}
          description={t("loans.detailsHint")}
        />
        <CardBody className="space-y-1.5 text-sm">
          {accountRows.map((row) => (
            <p key={row.label} className="flex justify-between gap-3">
              <span className="text-ink-muted">{row.label}</span>
              <span className="numeric font-medium text-ink">
                {money(row.value)}
              </span>
            </p>
          ))}

          {/* El total es la suma de los renglones de arriba, no una cuenta
              aparte: lo que se ve cuadra siempre con lo que está escrito. */}
          <p className="flex justify-between gap-3 border-t border-border pt-1.5">
            <span className="font-medium text-ink">
              {t("loans.totalToPay")}
            </span>
            <span className="numeric font-bold text-ink">
              {money(totalToPay)}
            </span>
          </p>

          {/* Con el menos delante: es lo único que baja en esta cuenta, y sin
              el signo se leía como una cifra más que se suma. */}
          <p className="flex justify-between gap-3">
            <span className="text-ink-muted">{t("loans.alreadyPaid")}</span>
            <span className="numeric font-medium text-positive">
              −{money(Number(loan.totalPaid))}
            </span>
          </p>

          <p className="flex justify-between gap-3 border-t border-border pt-1.5">
            <span className="font-semibold text-ink">
              {t("loans.outstanding")}
            </span>
            <span className="numeric text-base font-bold text-brand-strong">
              {money(Number(loan.outstanding))}
            </span>
          </p>

          {/* Cuánto lleva andado, que es lo que el cliente pregunta primero.
              La barra dice de un vistazo lo que el «1 de 30» dice exacto. */}
          {loan.installments.length > 0 ? (
            <div className="border-t border-border pt-2.5">
              <p className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {t("loans.paidInstallments")}
                </span>
                <span className="numeric font-medium text-ink">
                  {t("loans.paidOfTotal")
                    .replace("{paid}", String(collect.paidCount))
                    .replace("{total}", String(loan.installments.length))}
                </span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-positive"
                    style={{ width: `${paidPercent}%` }}
                  />
                </div>
                <span className="numeric text-[0.6875rem] font-semibold text-positive">
                  {t("loans.paidPercent").replace(
                    "{percent}",
                    String(paidPercent),
                  )}
                </span>
              </div>
            </div>
          ) : null}

          {/* En qué quedó el trato: cuántas cuotas, de a cuánto y entre qué
              fechas. Es lo que vuelve comprobable el día del final en vez de
              pedir que se crea. */}
          <div className="space-y-1.5 border-t border-border pt-2.5">
            {[
              loan.installments.length > 0
                ? {
                    label: t("loans.installmentsLabel"),
                    value: t("loans.countAndFrequency")
                      .replace("{count}", String(loan.installments.length))
                      .replace(
                        "{frequency}",
                        t(`loans.frequencyLabel.${loan.frequency}`),
                      ),
                  }
                : null,
              collect.installmentCents > 0
                ? {
                    label: t("loans.installmentValue"),
                    value: money(fromCents(collect.installmentCents)),
                  }
                : null,
              { label: t("loans.startLabel"), value: formatDate(startedOn) },
              // El día en que empieza el cobro solo cuando no es el mismo en
              // que salió la plata: repetir la fecha no dice nada.
              showFirstDue
                ? {
                    label: t("loans.firstDueShort"),
                    value: formatDate(firstDueDate),
                  }
                : null,
              {
                label: t(
                  loan.closingDate ? "loans.endedLabel" : "loans.endLabel",
                ),
                value: endsOn ? formatDate(endsOn) : "—",
              },
            ]
              .filter((row) => row !== null)
              .map((row) => (
                <p key={row.label} className="flex justify-between gap-3">
                  <span className="text-ink-muted">{row.label}</span>
                  <span className="numeric font-medium text-ink">
                    {row.value}
                  </span>
                </p>
              ))}
          </div>

          {/* Lo que se atrasó, en rojo y de último: es lo que decide si hay
              que ir hoy a esa puerta, y se lee después de saber de qué
              préstamo se está hablando. */}
          {overdueCount > 0 || catchUp > 0 || daysExpired > 0 ? (
            <div className="space-y-1.5 border-t border-border pt-2.5">
              {[
                overdueCount > 0
                  ? {
                      label: t("loans.overdueInstallments"),
                      value:
                        dueSoFar > 0
                          ? `${overdueCount} ${t("loans.overdueOfDue").replace(
                              "{count}",
                              String(dueSoFar),
                            )}`
                          : String(overdueCount),
                    }
                  : null,
                catchUp > 0
                  ? { label: t("loans.overdueBalance"), value: money(catchUp) }
                  : null,
                collect.overdueSince
                  ? {
                      label: t("loans.oldestOverdueLabel"),
                      value: formatDate(collect.overdueSince),
                    }
                  : null,
                daysExpired > 0
                  ? {
                      label: t("loans.expiredLabel"),
                      value: t(
                        daysExpired === 1
                          ? "loans.expiredDaysOne"
                          : "loans.expiredDays",
                      ).replace("{days}", String(daysExpired)),
                    }
                  : null,
              ]
                .filter((row) => row !== null)
                .map((row) => (
                  <p key={row.label} className="flex justify-between gap-3">
                    <span className="text-danger">{row.label}</span>
                    <span className="numeric font-semibold text-danger">
                      {row.value}
                    </span>
                  </p>
                ))}
            </div>
          ) : null}
        </CardBody>
      </Card>

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
                pendingCharges={pendingCharges}
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
            paid: Number(charge.paidAmount),
          }))}
          principal={Number(loan.principal)}
          currencyCode={context.currencyCode}
          locale={context.locale}
          decimalPlaces={context.decimalPlaces}
          canEdit={
            can(context, "loans.update") &&
            canEditAtAll(loan.status as LoanStatus)
          }
          disbursed={loan.disbursedAt !== null}
        />
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
          {loan.payments.length === 0 && chargesApart.length === 0 ? (
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
              {/* Cada cifra en su propio recuadro, como los del resumen del
                  día. Sueltas sobre el fondo, con una raya de por medio y sin
                  aire alrededor, no se veía dónde acababa una y empezaba la
                  otra. En el teléfono van de a dos: en una sola fila,
                  «$1.262.500» se montaba encima del de al lado. */}
              <div
                className={`grid grid-cols-2 gap-2 border-b border-border p-3 ${
                  appliedTiles.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"
                }`}
              >
                {appliedTiles.map((tile, index) => (
                  <div
                    key={tile.label}
                    // De a dos, el último de una cantidad impar quedaba solo a
                    // media fila con un hueco al lado; ocupando el ancho la
                    // fila se cierra.
                    className={`rounded-[--radius-card] border border-border bg-surface-muted/50 px-2 py-2 text-center ${
                      index === appliedTiles.length - 1 &&
                      appliedTiles.length % 2 === 1
                        ? "col-span-2 sm:col-span-1"
                        : ""
                    }`}
                  >
                    <p className="text-[0.625rem] font-medium tracking-wide text-ink-muted uppercase">
                      {tile.label}
                    </p>
                    <p
                      className={`numeric mt-0.5 text-sm font-bold ${tile.tone}`}
                    >
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
                    const paymentRows = loan.payments.map((payment, index) => {
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

                      return {
                        at: payment.paidAt,
                        node: (
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
                            <Td>
                              {t(`payments.methodLabel.${payment.method}`)}
                            </Td>
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
                            <Td
                              align="right"
                              numeric
                              className="text-ink-muted"
                            >
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
                                    <DeletePaymentButton
                                      paymentId={payment.id}
                                    />
                                  </span>
                                )}
                              </Td>
                            ) : null}
                          </tr>
                        ),
                      };
                    });

                    // Un cargo cobrado en la puerta es plata que el cliente
                    // entregó por este préstamo, así que va en el mismo
                    // historial y en su fecha. No baja lo que debe — por eso
                    // la columna del saldo va en raya y no repite el número
                    // anterior, que se leería como si el saldo se hubiera
                    // quedado quieto por el abono.
                    const chargeRows = chargesApart.map((charge) => {
                      const who = charge.createdById
                        ? collectors.get(charge.createdById)
                        : null;
                      return {
                        at: charge.createdAt,
                        node: (
                          <tr key={charge.id}>
                            <Td numeric>
                              <span className="font-medium text-ink">
                                {formatDate(
                                  dayIn(charge.createdAt, context.timezone),
                                )}
                              </span>{" "}
                              <span className="numeric text-ink-muted">
                                {formatTime(
                                  charge.createdAt,
                                  context.locale,
                                  context.timezone,
                                )}
                              </span>
                              {who ? (
                                <span className="mt-0.5 block text-[0.6875rem] text-ink-subtle">
                                  {t("payments.collectedByShort").replace(
                                    "{name}",
                                    who,
                                  )}
                                </span>
                              ) : null}
                            </Td>
                            <Td>{t("payments.conceptLabel.CHARGE")}</Td>
                            <Td align="right" numeric>
                              <span className="font-medium">
                                {money(Number(charge.amount))}
                              </span>
                              <span className="numeric mt-0.5 block text-[0.6875rem] text-ink-subtle">
                                {charge.chargeName}
                              </span>
                            </Td>
                            <Td
                              align="right"
                              numeric
                              className="text-ink-muted"
                            >
                              —
                            </Td>
                            {canReverse ? <Td align="right">{""}</Td> : null}
                          </tr>
                        ),
                      };
                    });

                    // Todo junto y en orden, del más nuevo al más viejo: el
                    // cliente pregunta "¿qué le entregué?" sin separar en su
                    // cabeza los abonos de los cargos.
                    const rows = [...paymentRows, ...chargeRows]
                      .sort((a, b) => b.at.getTime() - a.at.getTime())
                      .map((row) => row.node);

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
