import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { LoanRow } from "@/components/loans/loan-row";
import { SortableRows } from "@/components/ui/sortable-rows";
import { startOfDay } from "@/core/dates";
import { isManuallyOrdered } from "@/core/ordering";
import { can, requirePermission } from "@/server/auth/context";
import { crookedLoans } from "@/server/services/first-due-fix";
import { db } from "@/server/db";
import { LOAN_ORDER } from "@/server/services/ordering";

import { moveLoanAction } from "./actions";
import { FixAllFirstDue } from "./fix-all-first-due";

export const dynamic = "force-dynamic";

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
  // De un anulado no se cobra, así que tampoco se atrasa por más cuotas sin
  // pagar que le queden colgando.
  const open: Prisma.LoanWhereInput = {
    status: { in: ["ACTIVE", "IN_ARREARS", "APPROVED"] },
  };
  // Al crédito le queda plazo mientras le quede alguna cuota por vencer.
  const stillRunning: Prisma.LoanWhereInput = {
    installments: { some: { dueDate: { gte: today } } },
  };
  return {
    all: {} as Prisma.LoanWhereInput,
    onTime: {
      status: { in: ["ACTIVE", "APPROVED"] },
      NOT: unpaidBefore(today),
    },
    // Atrasado en cuotas pero con plazo por delante: todavía se arregla
    // cobrando. Vencido es que se acabó el plazo y sigue debiendo.
    late: { ...open, AND: [unpaidBefore(today), stillRunning] },
    expired: {
      ...open,
      AND: [
        { installments: { some: { status: { notIn: ["PAID", "WAIVED"] } } } },
        { NOT: stillRunning },
      ],
    },
    paid: { status: "PAID" },
  } satisfies Record<string, Prisma.LoanWhereInput>;
}

type FilterKey = keyof ReturnType<typeof buildFilters>;

const FILTER_KEYS: FilterKey[] = ["all", "onTime", "late", "expired", "paid"];

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "loans.filterAll",
  onTime: "loans.filterOnTime",
  late: "loans.filterLate",
  expired: "loans.filterExpired",
  paid: "loans.filterPaid",
};

/** De estos se cobra. De un borrador todavía no, y de un anulado nunca más. */

/**
 * La franja de la izquierda: se lee sin leer, bajando con el pulgar.
 *
 * Rojo es que el plazo ya se acabó y todavía debe; amarillo, que se quedó
 * atrás en cuotas pero el crédito sigue corriendo. Son dos cosas distintas y
 * la segunda todavía se arregla cobrando.
 */
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

  // Los que vienen de antes de la regla de no cobrar el día de la entrega:
  // se ofrecen para enderezarlos todos juntos, y el aviso se va solo cuando
  // no queda ninguno.
  const crooked = can(context, "loans.update")
    ? await crookedLoans(context.companyId, context.timezone)
    : [];

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
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
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

      {crooked.length > 0 ? (
        <FixAllFirstDue
          count={crooked.length}
          codes={crooked.slice(0, 6).map((loan) => loan.code)}
        />
      ) : null}

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
          {loans.map((loan) => (
            <LoanRow
              key={loan.id}
              loan={loan}
              now={now}
              t={t}
              money={money}
              locale={context.locale}
              title={`${loan.customer.firstName} ${loan.customer.lastName}`}
              sortableId={loan.id}
            />
          ))}
        </SortableRows>
      )}
    </>
  );
}
