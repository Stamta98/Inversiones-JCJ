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
const KINDS = ["NEW", "RENEWAL", "REFINANCE", "EXPENSE", "CHARGE"] as const;
type Kind = (typeof KINDS)[number];

const TITLES: Record<Kind, string> = {
  NEW: "payments.summary.detailLoans",
  RENEWAL: "payments.summary.detailRenewals",
  REFINANCE: "payments.summary.detailRefinances",
  EXPENSE: "payments.summary.detailExpenses",
  CHARGE: "payments.summary.detailCharges",
};

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
    kind === "EXPENSE" || kind === "CHARGE"
      ? []
      : await db.loan.findMany({
          where: {
            companyId: context.companyId,
            disbursedAt: today,
            status: { not: "CANCELLED" },
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

  // Los cargos que se descontaron al entregar la plata: entraron a la caja
  // ese mismo día y ya quedaron cobrados.
  const chargeMovements =
    kind === "CHARGE"
      ? await db.cashMovement.findMany({
          where: {
            cashBox: { companyId: context.companyId },
            kind: "CHARGE_COLLECTED",
            createdAt: today,
          },
          select: {
            id: true,
            amount: true,
            description: true,
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

  // El cargo que se repartió entre las cuotas no llega de una: va entrando
  // con cada abono, y ese pedazo también es cargo cobrado ese día.
  const chargePayments =
    kind === "CHARGE"
      ? await db.payment.findMany({
          where: {
            companyId: context.companyId,
            status: "POSTED",
            // Un traspaso de refinanciación no es plata que entró.
            method: { not: "REFINANCE" },
            paidAt: today,
            allocations: { some: { chargeAmount: { gt: 0 } } },
          },
          select: {
            id: true,
            loan: {
              select: {
                id: true,
                code: true,
                customer: { select: { firstName: true, lastName: true } },
              },
            },
            allocations: { select: { chargeAmount: true } },
          },
          orderBy: { paidAt: "desc" },
        })
      : [];

  // Los dos orígenes en una sola lista: para quien cierra el día son lo
  // mismo, cargos que se cobraron.
  const charges = [
    ...chargeMovements.map((movement) => ({
      id: movement.id,
      loanId: movement.loan?.id ?? null,
      // Si el préstamo se borró, queda lo que dijo la caja ese día.
      who: movement.loan
        ? `${movement.loan.customer.firstName} ${movement.loan.customer.lastName}`
        : (movement.description ?? ""),
      code: movement.loan?.code ?? "",
      how: t("payments.summary.chargeDeducted"),
      amount: Math.abs(Number(movement.amount)),
    })),
    ...chargePayments.map((payment) => ({
      id: payment.id,
      loanId: payment.loan.id,
      who: `${payment.loan.customer.firstName} ${payment.loan.customer.lastName}`,
      code: payment.loan.code,
      how: t("payments.summary.chargeInstallment"),
      amount: payment.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.chargeAmount),
        0,
      ),
    })),
  ].filter((charge) => charge.amount > 0);

  const carriedOn = (loan: (typeof loans)[number]) =>
    (loan.parentLoan?.payments ?? []).reduce(
      (total, payment) => total + Number(payment.amount),
      0,
    );

  const total =
    kind === "CHARGE"
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
    kind === "CHARGE"
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
