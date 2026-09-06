import Link from "next/link";

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  Icon,
  PageHeader,
  type Tone,
} from "@/components/ui";
import { addDays, dayParam, parseDay, startOfDay } from "@/core/dates";
import type { LoanStatus } from "@/core/types";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Los cuadros del resumen abren aquí, cada uno con lo suyo. */
const KINDS = [
  "NEW",
  "RENEWAL",
  "REFINANCE",
  "EXPENSE",
  "CHARGE",
  "COLLECTED",
] as const;
type Kind = (typeof KINDS)[number];

const TITLES: Record<Kind, string> = {
  NEW: "payments.summary.detailLoans",
  RENEWAL: "payments.summary.detailRenewals",
  REFINANCE: "payments.summary.detailRefinances",
  EXPENSE: "payments.summary.detailExpenses",
  CHARGE: "payments.summary.detailCharges",
  COLLECTED: "payments.summary.detailCollected",
};

const LOAN_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  ACTIVE: "positive",
  IN_ARREARS: "danger",
  PAID: "brand",
  WRITTEN_OFF: "warning",
};

/** Un dato del préstamo, con su icono de color, como en la ficha. */
function Fact({
  icon,
  tint,
  label,
  value,
}: {
  icon:
    | "credit-card"
    | "trending-down"
    | "calendar"
    | "clock"
    | "alert-triangle";
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tint}`}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-ink-muted">{label}</span>
        {/* "20% del préstamo" no cabe en media columna de un teléfono: mejor
            que baje a dos renglones a que se corte. */}
        <span className="numeric block text-sm leading-tight font-bold text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

export default async function DayDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; date?: string }>;
}) {
  const context = await requirePermission("payments.read");
  const { kind: raw, date } = await searchParams;
  const kind: Kind = KINDS.includes(raw as Kind) ? (raw as Kind) : "NEW";

  // El mismo día que se estaba viendo en el resumen; sin fecha, hoy.
  const now = startOfDay(new Date());
  const dayStart = parseDay(date) ?? now;
  const today = { gte: dayStart, lt: addDays(dayStart, 1) };
  const isToday = dayStart.getTime() === now.getTime();
  const selected = dayParam(dayStart);
  const { t, money } = context;

  const loans =
    kind === "EXPENSE" || kind === "CHARGE" || kind === "COLLECTED"
      ? []
      : await db.loan.findMany({
          where: {
            companyId: context.companyId,
            disbursedAt: today,
            origin: kind,
          },
          include: {
            customer: { select: { firstName: true, lastName: true } },
            // Lo que se trasladó del préstamo viejo, que es lo que separa
            // "prestado" de "entregado".
            parentLoan: {
              select: {
                payments: {
                  where: {
                    method: "REFINANCE",
                    status: "POSTED",
                    paidAt: today,
                  },
                  select: { amount: true },
                },
              },
            },
          },
          orderBy: { disbursedAt: "desc" },
        });

  const expenses =
    kind === "EXPENSE"
      ? await db.expense.findMany({
          where: { companyId: context.companyId, spentAt: today },
          include: {
            category: { select: { name: true } },
            cashBox: { select: { name: true } },
          },
          orderBy: { spentAt: "desc" },
        })
      : [];

  // Cada abono del día, con el préstamo al que entró: es lo que se cobró y,
  // al lado, lo que a ese préstamo le sigue faltando. Un traspaso de
  // refinanciación no se cobró, se trasladó: no cuenta como plata que entró.
  const collected =
    kind === "COLLECTED"
      ? await db.payment.findMany({
          where: {
            companyId: context.companyId,
            status: "POSTED",
            method: { not: "REFINANCE" },
            paidAt: today,
          },
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
            receiptNumber: true,
            loan: {
              select: {
                id: true,
                code: true,
                status: true,
                outstanding: true,
                customer: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        })
      : [];

  // El cargo que se le descontó al cliente al entregarle la plata, leído del
  // préstamo y no de la caja: uno entregado sin caja escogida igual se lo
  // cobró, y la lista salía vacía mientras el recuadro decía que sí hubo.
  const chargedLoans =
    kind === "CHARGE"
      ? await db.loan.findMany({
          where: {
            companyId: context.companyId,
            disbursedAt: today,
            charges: { some: { mode: "DEDUCTED" } },
          },
          select: {
            id: true,
            code: true,
            customer: { select: { firstName: true, lastName: true } },
            charges: { where: { mode: "DEDUCTED" }, select: { amount: true } },
          },
          orderBy: { disbursedAt: "desc" },
        })
      : [];

  // Los cargos que pasaron por la caja: el que se le cobró al cliente aparte
  // de la cuota, y el que se le descontó después a un préstamo de otro día.
  // El del préstamo de hoy sale de la lista de arriba, o iría dos veces.
  const chargeMovements =
    kind === "CHARGE"
      ? await db.cashMovement.findMany({
          where: {
            cashBox: { companyId: context.companyId },
            kind: "CHARGE_COLLECTED",
            createdAt: today,
            OR: [
              { chargeName: { not: null } },
              { chargeName: null, NOT: { loan: { disbursedAt: today } } },
            ],
          },
          select: {
            id: true,
            amount: true,
            description: true,
            chargeName: true,
            loan: {
              select: {
                id: true,
                code: true,
                customer: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  // Los dos orígenes en una sola lista: para quien cierra el día son lo
  // mismo, cargos que se cobraron. El cargo que se repartió entre las cuotas
  // no está aquí: entró dentro del abono y ya se cuenta en «Total cobrado».
  const charges = [
    ...chargedLoans.map((loan) => ({
      id: loan.id,
      loanId: loan.id,
      who: `${loan.customer.firstName} ${loan.customer.lastName}`,
      code: loan.code,
      how: t("payments.summary.chargeDeducted"),
      amount: loan.charges.reduce(
        (sum, charge) => sum + Number(charge.amount),
        0,
      ),
    })),
    ...chargeMovements.map((movement) => ({
      id: movement.id,
      loanId: movement.loan?.id ?? null,
      // Si el préstamo se borró, queda lo que dijo la caja ese día.
      who: movement.loan
        ? `${movement.loan.customer.firstName} ${movement.loan.customer.lastName}`
        : (movement.description ?? ""),
      code: movement.loan?.code ?? "",
      // Con nombre, el cargo se le cobró al cliente aparte de la cuota; sin
      // nombre, es el que se le descontó al entregarle la plata.
      how: movement.chargeName
        ? `${t("payments.summary.chargeApart")} · ${movement.chargeName}`
        : t("payments.summary.chargeDeducted"),
      amount: Math.abs(Number(movement.amount)),
    })),
  ].filter((charge) => charge.amount > 0);

  const carriedOn = (loan: (typeof loans)[number]) =>
    (loan.parentLoan?.payments ?? []).reduce(
      (total, payment) => total + Number(payment.amount),
      0,
    );

  const total =
    kind === "COLLECTED"
      ? collected.reduce((sum, payment) => sum + Number(payment.amount), 0)
      : kind === "CHARGE"
        ? charges.reduce((sum, charge) => sum + charge.amount, 0)
        : kind === "EXPENSE"
          ? expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
          : loans.reduce((sum, loan) => {
              const carried = carriedOn(loan);
              return (
                sum +
                (kind === "REFINANCE"
                  ? carried
                  : kind === "RENEWAL"
                    ? Math.max(0, Number(loan.principal) - carried)
                    : Number(loan.principal))
              );
            }, 0);

  const empty =
    kind === "COLLECTED"
      ? collected.length === 0
      : kind === "CHARGE"
        ? charges.length === 0
        : kind === "EXPENSE"
          ? expenses.length === 0
          : loans.length === 0;

  return (
    <>
      <PageHeader
        title={t(TITLES[kind])}
        description={`${
          isToday
            ? `${t("payments.summary.dayToday")} · ${formatDate(dayStart)}`
            : formatDate(dayStart)
        } · ${t("payments.summary.detailTotal")}: ${money(total)}`}
      />

      <Link
        href={`/payments?date=${selected}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline"
      >
        <Icon name="arrow-left" size={16} />
        {t("payments.summary.back")}
      </Link>

      {empty ? (
        <Card>
          <EmptyState
            icon="receipt"
            title={t(TITLES[kind])}
            hint={t("payments.summary.detailEmpty")}
          />
        </Card>
      ) : kind === "COLLECTED" ? (
        <>
          <p className="mb-2 text-xs text-ink-muted">
            {t("payments.summary.collectedHint")}
          </p>
          <div className="space-y-2">
            {collected.map((payment) => (
              <Card key={payment.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <Link
                      href={`/loans/${payment.loan.id}`}
                      className="block truncate text-sm font-semibold text-ink hover:underline"
                    >
                      {payment.loan.customer.firstName}{" "}
                      {payment.loan.customer.lastName}
                    </Link>
                    <span className="numeric block truncate text-xs text-ink-muted">
                      {payment.loan.code} ·{" "}
                      {t(`payments.methodLabel.${payment.method}`)} ·{" "}
                      {payment.receiptNumber}
                    </span>
                  </span>
                  <span className="numeric shrink-0 text-sm font-bold text-positive">
                    {money(Number(payment.amount))}
                  </span>
                </div>

                {/* Lo que se cobró no dice nada solo: al lado va lo que a ese
                    préstamo le sigue faltando, que es por lo que se vuelve. */}
                <p className="mt-2 flex justify-between gap-3 border-t border-border pt-2 text-xs">
                  <span className="text-ink-muted">
                    {t("loans.outstanding")}
                  </span>
                  <span className="numeric font-semibold text-ink">
                    {Number(payment.loan.outstanding) > 0
                      ? money(Number(payment.loan.outstanding))
                      : t("payments.summary.collectedNoBalance")}
                  </span>
                </p>
              </Card>
            ))}
          </div>
        </>
      ) : kind === "CHARGE" ? (
        <>
          <p className="mb-2 text-xs text-ink-muted">
            {t("payments.summary.chargesHint")}
          </p>
          <div className="space-y-2">
            {charges.map((charge) => (
              <Card key={charge.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    {/* El nombre lleva a su préstamo: de ahí salió el cargo. */}
                    {charge.loanId ? (
                      <Link
                        href={`/loans/${charge.loanId}`}
                        className="block truncate text-sm font-semibold text-ink hover:underline"
                      >
                        {charge.who}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold text-ink">
                        {charge.who}
                      </span>
                    )}
                    <span className="numeric block truncate text-xs text-ink-muted">
                      {charge.code ? `${charge.code} · ` : ""}
                      {charge.how}
                    </span>
                  </span>
                  <span className="numeric shrink-0 text-sm font-bold text-brand-strong">
                    {money(charge.amount)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : kind === "EXPENSE" ? (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <Card key={expense.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {expense.description}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {expense.category?.name ??
                      t("payments.summary.expenseCategory")}
                    {expense.cashBox ? ` · ${expense.cashBox.name}` : ""}
                  </span>
                </span>
                <span className="numeric shrink-0 text-sm font-bold text-danger">
                  {money(Number(expense.amount))}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const carried = carriedOn(loan);
            const handed =
              kind === "REFINANCE"
                ? carried
                : kind === "RENEWAL"
                  ? Math.max(0, Number(loan.principal) - carried)
                  : Number(loan.principal);

            return (
              <Card key={loan.id} className="overflow-hidden">
                {/* El nombre arriba, como en la ficha del préstamo: es por
                    quien se pregunta. */}
                <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-3 py-2">
                  <Icon name="users" size={16} className="text-ink-subtle" />
                  <Link
                    href={`/loans/${loan.id}`}
                    className="truncate text-sm font-bold text-ink uppercase hover:underline"
                  >
                    {loan.customer.firstName} {loan.customer.lastName}
                  </Link>
                </div>

                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="info">{loan.code}</Badge>
                    <Badge
                      tone={LOAN_TONES[loan.status as LoanStatus] ?? "neutral"}
                    >
                      {t(`loans.status.${loan.status}`)}
                    </Badge>
                    {kind !== "NEW" ? (
                      <Badge tone="warning">
                        {t(
                          kind === "RENEWAL"
                            ? "payments.summary.amountHandedOut"
                            : "payments.summary.amountCarried",
                        )}
                        : {money(handed)}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Fact
                      icon="credit-card"
                      tint="bg-positive-soft text-positive"
                      label={t("payments.summary.capital")}
                      value={money(Number(loan.principal))}
                    />
                    <Fact
                      icon="trending-down"
                      tint="bg-brand-soft text-brand-strong"
                      label={t("payments.summary.rate")}
                      value={`${Number(loan.interestRate)}% ${t(
                        `loans.rateBasisShort.${loan.rateBasis}`,
                      )}`}
                    />
                    <Fact
                      icon="calendar"
                      tint="bg-info-soft text-info"
                      label={t("payments.summary.mode")}
                      value={
                        loan.frequency === "CUSTOM" && loan.customIntervalDays
                          ? `${t("loans.frequencyLabel.CUSTOM")} (${loan.customIntervalDays} d)`
                          : t(`loans.frequencyLabel.${loan.frequency}`)
                      }
                    />
                    <Fact
                      icon="clock"
                      tint="bg-warning-soft text-warning"
                      label={t("payments.summary.term")}
                      value={t("payments.summary.termOf").replace(
                        "{count}",
                        String(loan.termCount),
                      )}
                    />
                    <Fact
                      icon="calendar"
                      tint="bg-surface-muted text-ink-muted"
                      label={t("payments.summary.startsOn")}
                      value={formatDate(loan.firstDueDate)}
                    />
                    <Fact
                      icon="alert-triangle"
                      tint="bg-danger-soft text-danger"
                      label={t("payments.summary.lateFeePerInstallment")}
                      value={
                        loan.lateFeeMode === "NONE"
                          ? money(0)
                          : loan.lateFeeMode === "FIXED_PER_DAY"
                            ? money(Number(loan.lateFeeValue))
                            : `${Number(loan.lateFeeValue)}%`
                      }
                    />
                  </div>
                </CardBody>

                <p className="border-t border-border bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                  {t("payments.summary.graceHint").replace(
                    "{days}",
                    String(loan.gracePeriodDays),
                  )}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
