import { notFound } from "next/navigation";

import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { LoanRow } from "@/components/loans/loan-row";
import { startOfDay } from "@/core/dates";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Se acabaron: no se cobran más y no vuelven a moverse. */
const FINISHED = ["PAID", "CANCELLED", "WRITTEN_OFF"];

/**
 * Los que se están cobrando, contados igual que en la ficha del cliente.
 *
 * Un borrador todavía no se cobra —la plata no ha salido— así que no entra
 * en "activos" ni en lo que el cliente debe, pero tampoco está terminado:
 * aparece arriba, entre los que siguen en curso.
 */
const COLLECTING = ["ACTIVE", "IN_ARREARS", "APPROVED"];

/**
 * El historial de préstamos de un cliente.
 *
 * Todos los que se le han hecho, sin quitar ninguno: los que se están
 * cobrando arriba y los que ya se acabaron —saldados, anulados, incobrables—
 * debajo. Un préstamo terminado sigue diciendo algo de la persona: cuántas
 * veces ha vuelto, si pagó o si tocó anularlo. Por eso no se filtra nada.
 */
export default async function CustomerLoansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { id } = await params;
  const { t, money } = context;
  const now = new Date();

  const customer = await db.customer.findFirst({
    where: { id, companyId: context.companyId },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      loans: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              installments: {
                where: {
                  dueDate: { lt: startOfDay(now) },
                  status: { notIn: ["PAID", "WAIVED"] },
                },
              },
            },
          },
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
      },
    },
  });

  if (!customer) notFound();

  const open = customer.loans.filter(
    (loan) => !FINISHED.includes(loan.status),
  );
  const closed = customer.loans.filter((loan) =>
    FINISHED.includes(loan.status),
  );
  const collecting = customer.loans.filter((loan) =>
    COLLECTING.includes(loan.status),
  );

  // Un préstamo anulado nunca salió de la caja, así que no cuenta como plata
  // entregada, pero sí se queda en la lista: pasó.
  const lentTotal = customer.loans
    .filter((loan) => loan.status !== "CANCELLED")
    .reduce((total, loan) => total + Number(loan.principal), 0);
  const outstanding = collecting.reduce(
    (total, loan) => total + Number(loan.outstanding),
    0,
  );

  const row = (loan: (typeof customer.loans)[number]) => (
    <LoanRow
      key={loan.id}
      loan={loan}
      now={now}
      t={t}
      money={money}
      locale={context.locale}
    />
  );

  return (
    <>
      <PageHeader
        title={t("customers.loansHistory")}
        description={`${customer.code} · ${customer.firstName} ${customer.lastName}`}
        action={
          <LinkButton
            href={`/customers/${customer.id}`}
            variant="secondary"
            icon="arrow-left"
          >
            {t("common.back")}
          </LinkButton>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          compact
          label={t("customers.loansTotal")}
          value={String(customer.loans.length)}
          icon="hand-coins"
        />
        <StatCard
          compact
          label={t("customers.loansActive")}
          value={String(collecting.length)}
          icon="check"
          tone="positive"
        />
        <StatCard
          compact
          label={t("customers.lentTotal")}
          value={money(lentTotal)}
          icon="wallet"
        />
        <StatCard
          compact
          label={t("loans.outstanding")}
          value={money(outstanding)}
          icon="hand-coins"
        />
      </div>

      {customer.loans.length === 0 ? (
        <div className="mt-4">
          <Card>
            <EmptyState
              icon="hand-coins"
              title={t("loans.emptyTitle")}
              hint={t("loans.emptyHint")}
            />
          </Card>
        </div>
      ) : null}

      {open.length > 0 ? (
        <div className="mt-4">
          <Card>
            <CardHeader title={t("customers.loansInProgress")} />
            <CardBody className="space-y-2">{open.map(row)}</CardBody>
          </Card>
        </div>
      ) : null}

      {/* Los que ya se acabaron, debajo y sin resaltar, pero enteros: es el
          historial, y lo que se acabó también cuenta la historia. */}
      {closed.length > 0 ? (
        <div className="mt-4">
          <Card>
            <CardHeader
              title={t("customers.loansClosed")}
              description={t("customers.loansClosedHint")}
            />
            <CardBody className="space-y-2">{closed.map(row)}</CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
