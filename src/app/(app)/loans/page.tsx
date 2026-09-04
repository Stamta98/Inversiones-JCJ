import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  type Tone,
} from "@/components/ui";
import { SortableRows } from "@/components/ui/sortable-rows";
import { addDays, startOfDay } from "@/core/dates";
import { collectionSnapshot } from "@/core/loans/collection";
import { fromCents, toCents } from "@/core/money";
import { isManuallyOrdered } from "@/core/ordering";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { LOAN_ORDER } from "@/server/services/ordering";

import { moveLoanAction } from "./actions";

export const dynamic = "force-dynamic";

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

/**
 * Los filtros llevan nombre a propósito.
 *
 * La referencia usa siete botones de colores sin etiqueta y hay que
 * aprendérselos; con cuatro nombres se lee sin adivinar y se cubre lo mismo.
 */
/**
 * El atraso se pregunta por las cuotas, no por la columna `daysInArrears`.
 *
 * Esa columna la escribe el trabajo de la madrugada, así que entre las doce
 * de la noche y esa hora dice el atraso de ayer. Las tarjetas cuentan los
 * días al abrir la lista, y si el filtro mirara la columna diría que no hay
 * nadie en mora mientras las tarjetas muestran los días. Preguntando por la
 * fecha de las cuotas las dos cosas dicen lo mismo a cualquier hora.
 */
function unpaidBefore(date: Date): Prisma.LoanWhereInput {
  return {
    installments: {
      some: {
        dueDate: { lt: date },
        status: { notIn: ["PAID", "WAIVED"] },
      },
    },
  };
}

function buildFilters(today: Date) {
  const heavyFrom = addDays(today, -30);
  // De un anulado no se cobra, así que tampoco se atrasa por más cuotas sin
  // pagar que le queden colgando.
  const open: Prisma.LoanWhereInput = {
    status: { in: ["ACTIVE", "IN_ARREARS", "APPROVED"] },
  };
  return {
    all: {} as Prisma.LoanWhereInput,
    onTime: {
      status: { in: ["ACTIVE", "APPROVED"] },
      NOT: unpaidBefore(today),
    },
    late: { ...open, ...unpaidBefore(today), NOT: unpaidBefore(heavyFrom) },
    heavy: { ...open, ...unpaidBefore(heavyFrom) },
    paid: { status: "PAID" },
  } satisfies Record<string, Prisma.LoanWhereInput>;
}

type FilterKey = keyof ReturnType<typeof buildFilters>;

const FILTER_KEYS: FilterKey[] = ["all", "onTime", "late", "heavy", "paid"];

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "loans.filterAll",
  onTime: "loans.filterOnTime",
  late: "loans.filterLate",
  heavy: "loans.filterHeavy",
  paid: "loans.filterPaid",
};

/** De estos se cobra. De un borrador todavía no, y de un anulado nunca más. */
const COLLECTABLE = new Set(["ACTIVE", "IN_ARREARS", "APPROVED"]);

/** La franja de la izquierda: se lee sin leer, bajando con el pulgar. */
function severity(status: string, daysInArrears: number): string {
  if (status === "PAID") return "border-l-brand";
  if (status === "CANCELLED" || status === "WRITTEN_OFF") {
    return "border-l-border-strong";
  }
  if (daysInArrears > 30) return "border-l-danger";
  if (daysInArrears > 0) return "border-l-warning";
  return "border-l-positive";
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const context = await requirePermission("loans.read");
  const { status } = await searchParams;
  const now = new Date();
  const today = startOfDay(now);
  const filters = buildFilters(today);
  const filter: FilterKey =
    status && status in filters ? (status as FilterKey) : "all";

  const where: Prisma.LoanWhereInput = {
    companyId: context.companyId,
    ...filters[filter],
  };

  const [loans, totals] = await Promise.all([
    db.loan.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        installments: {
          select: {
            number: true,
            dueDate: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
          },
        },
        payments: {
          where: { status: "POSTED" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: { paidAt: true },
        },
      },
      // Primero lo que la persona puso a mano, después el orden de siempre.
      orderBy: LOAN_ORDER,
      take: 50,
    }),
    // Sobre todo lo que cumple el filtro, no solo la página: "cobrado" con
    // cincuenta préstamos en pantalla y trescientos detrás no sería cobrado.
    db.loan.aggregate({
      where,
      _sum: { principal: true, totalPaid: true, outstanding: true },
    }),
  ]);

  const { t, money } = context;
  const canOrder = can(context, "loans.update");
  const handOrdered = isManuallyOrdered(loans);

  const lent = Number(totals._sum.principal ?? 0);
  const collected = Number(totals._sum.totalPaid ?? 0);
  const pending = Number(totals._sum.outstanding ?? 0);
  const recovered =
    collected + pending > 0
      ? Math.round((collected / (collected + pending)) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title={t("loans.title")}
        action={
          can(context, "loans.create") ? (
            <LinkButton href="/loans/new" icon="plus">
              {t("loans.new")}
            </LinkButton>
          ) : null
        }
      />

      {/* Cuánto hay en la calle y cuánto ha vuelto. */}
      <Card className="mb-3 p-3">
        <div className="grid grid-cols-3 divide-x divide-border">
          {[
            { label: t("loans.lent"), value: lent, tone: "text-ink" },
            {
              label: t("loans.collected"),
              value: collected,
              tone: "text-positive",
            },
            { label: t("loans.toCollect"), value: pending, tone: "text-brand" },
          ].map((tile) => (
            <div key={tile.label} className="px-2 text-center">
              <p className="text-[0.625rem] font-medium tracking-wide text-ink-muted uppercase">
                {tile.label}
              </p>
              <p className={`numeric text-sm font-bold ${tile.tone}`}>
                {money(tile.value)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-positive"
              style={{ width: `${recovered}%` }}
            />
          </div>
          <span className="numeric text-[0.6875rem] font-semibold text-positive">
            {t("loans.recovered").replace("{percent}", String(recovered))}
          </span>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTER_KEYS.map((key) => (
          <Link
            key={key}
            href={key === "all" ? "/loans" : `/loans?status=${key}`}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (filter === key
                ? "border-brand bg-brand text-ink-inverse"
                : "border-border bg-surface text-ink-muted hover:border-brand")
            }
          >
            {t(FILTER_LABELS[key])}
          </Link>
        ))}
      </div>

      {canOrder && !handOrdered ? (
        <p className="mb-3 text-xs text-ink-subtle">{t("common.dragHint")}</p>
      ) : null}

      {loans.length === 0 ? (
        <Card>
          <EmptyState
            icon="hand-coins"
            title={t("loans.emptyTitle")}
            hint={t("loans.emptyHint")}
            action={
              can(context, "loans.create") ? (
                <LinkButton href="/loans/new" icon="plus" size="sm">
                  {t("loans.new")}
                </LinkButton>
              ) : null
            }
          />
        </Card>
      ) : (
        <SortableRows
          as="div"
          className="space-y-2"
          ids={loans.map((loan) => loan.id)}
          action={moveLoanAction}
          enabled={canOrder}
        >
          {loans.map((loan) => {
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
            // Un préstamo anulado conserva sus cuotas sin pagar, así que el
            // cálculo por sí solo pediría cobrarlas. De un anulado no se cobra.
            const collectable =
              COLLECTABLE.has(loan.status) && snapshot.kind !== "settled";
            // El atraso se cuenta al abrir la lista: un préstamo que nadie ha
            // tocado en una semana ya lleva esa semana, diga lo que diga la
            // columna guardada.
            const daysLate = collectable ? snapshot.daysLate : 0;
            const status =
              loan.status === "ACTIVE" && daysLate > 0
                ? "IN_ARREARS"
                : loan.status;
            const dueLabel =
              snapshot.kind === "overdue"
                ? t("loans.collectNow")
                : snapshot.kind === "upcoming"
                  ? t("loans.nextInstallment")
                  : t("loans.nothingDue");

            return (
              <Card
                key={loan.id}
                sortableId={loan.id}
                className={`overflow-hidden border-l-4 ${severity(loan.status, daysLate)}`}
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
                      {daysLate > 0 ? (
                        <span className="font-semibold text-danger">
                          {" · "}
                          {t("loans.arrearsDays").replace(
                            "{days}",
                            String(daysLate),
                          )}
                        </span>
                      ) : null}
                    </span>
                    <Badge tone={STATUS_TONES[status] ?? "neutral"}>
                      {t(`loans.status.${status}`)}
                    </Badge>
                  </span>

                  <span className="block truncate text-[0.9375rem] leading-snug font-bold text-ink">
                    {loan.customer.firstName} {loan.customer.lastName}
                  </span>

                  <span className="numeric block truncate text-xs leading-snug text-ink-subtle">
                    {t("loans.lastPayment")}{" "}
                    {lastPayment ? formatDate(lastPayment) : t("loans.noPayments")}
                    {snapshot.nextDueDate ? (
                      <>
                        {" · "}
                        {t("loans.nextInstallment")}{" "}
                        <span className="font-medium text-ink-muted">
                          {formatDate(snapshot.nextDueDate)}
                        </span>
                      </>
                    ) : null}
                  </span>

                  {/* Lo que se le pide en la puerta, aparte del saldo: son
                      números distintos y confundirlos es cobrar mal. */}
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
          })}
        </SortableRows>
      )}
    </>
  );
}
