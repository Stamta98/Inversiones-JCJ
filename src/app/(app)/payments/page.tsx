import Link from "next/link";

import {
  Badge,
  LinkButton,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { startOfDay } from "@/core/dates";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { DeletePaymentButton } from "./delete-payment-button";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const context = await requirePermission("payments.read");
  const dayStart = startOfDay(new Date());

  // Un traspaso de refinanciación se guarda como cobro para saldar el préstamo
  // viejo, pero esa plata nunca entró a la caja: contarla en el día sería
  // pedirle al cobrador que entregue lo que nadie le dio.
  const collectedToday = {
    companyId: context.companyId,
    status: "POSTED" as const,
    method: { not: "REFINANCE" as const },
    paidAt: { gte: dayStart },
  };

  const [
    payments,
    todayTotal,
    applied,
    byMethod,
    disbursed,
    expenses,
    newLoans,
    carried,
  ] = await Promise.all([
    db.payment.findMany({
      where: { companyId: context.companyId },
      include: { loan: { include: { customer: true } } },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    db.payment.aggregate({
      where: collectedToday,
      _sum: { amount: true },
      _count: true,
    }),
    // A qué se le abonó lo que entró: capital, interés, mora y cargos.
    db.paymentAllocation.aggregate({
      where: { payment: collectedToday },
      _sum: {
        principalAmount: true,
        interestAmount: true,
        chargeAmount: true,
        lateFeeAmount: true,
      },
    }),
    db.payment.groupBy({
      by: ["method"],
      where: collectedToday,
      _sum: { amount: true },
    }),
    // La plata que salió y la que se gastó las dice la caja, no los préstamos:
    // de una renovación solo sale la diferencia.
    db.cashMovement.aggregate({
      where: {
        cashBox: { companyId: context.companyId },
        kind: "LOAN_DISBURSEMENT",
        createdAt: { gte: dayStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
    db.cashMovement.aggregate({
      where: {
        cashBox: { companyId: context.companyId },
        kind: "EXPENSE",
        createdAt: { gte: dayStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
    db.loan.findMany({
      where: {
        companyId: context.companyId,
        disbursedAt: { gte: dayStart },
        status: { not: "CANCELLED" },
      },
      select: { origin: true, principal: true, parentLoanId: true },
    }),
    // Lo que se trasladó de cada préstamo viejo al nuevo, para saber qué
    // parte de una renovación fue plata entregada y qué parte fue traspaso.
    db.payment.groupBy({
      by: ["loanId"],
      where: {
        companyId: context.companyId,
        status: "POSTED",
        method: "REFINANCE",
        paidAt: { gte: dayStart },
      },
      _sum: { amount: true },
    }),
  ]);

  const { t, money } = context;
  const canReverse = can(context, "payments.delete");

  // La caja guarda las salidas en negativo; aquí se leen como lo que son.
  const collected = Number(todayTotal._sum.amount ?? 0);
  const lent = Math.abs(Number(disbursed._sum.amount ?? 0));
  const spent = Math.abs(Number(expenses._sum.amount ?? 0));
  const handOver = collected - lent - spent;

  const principalPaid = Number(applied._sum.principalAmount ?? 0);
  const interestPaid = Number(applied._sum.interestAmount ?? 0);
  const lateFeePaid = Number(applied._sum.lateFeeAmount ?? 0);
  const chargePaid = Number(applied._sum.chargeAmount ?? 0);
  // Lo que deja el día: el capital vuelve, no se gana. Los gastos sí salen.
  const profit = interestPaid + lateFeePaid + chargePaid - spent;

  // Refinanciar no mueve plata: traslada un saldo. Renovar traslada el saldo
  // y entrega la diferencia. Ninguna de las dos es "prestar" lo que dice el
  // monto del préstamo nuevo.
  const carriedFor = new Map(
    carried.map((row) => [row.loanId, Number(row._sum.amount ?? 0)]),
  );
  const carriedOn = (parentLoanId: string | null) =>
    parentLoanId ? (carriedFor.get(parentLoanId) ?? 0) : 0;

  const refinances = newLoans.filter((loan) => loan.origin === "REFINANCE");
  const renewals = newLoans.filter((loan) => loan.origin === "RENEWAL");
  const refinancedAmount = refinances.reduce(
    (total, loan) => total + carriedOn(loan.parentLoanId),
    0,
  );
  const renewedHandedOut = renewals.reduce(
    (total, loan) =>
      total + Math.max(0, Number(loan.principal) - carriedOn(loan.parentLoanId)),
    0,
  );

  const paidWith = byMethod
    .map((row) => ({
      method: row.method,
      amount: Number(row._sum.amount ?? 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const quiet =
    collected === 0 && lent === 0 && spent === 0 && newLoans.length === 0;

  return (
    <>
      <PageHeader title={t("payments.title")} />

      {/* La cuenta de la noche: con cuánto se queda el cobrador y de dónde
          salió. Es la pregunta con la que se cierra el día. */}
      <Card className="mb-3 p-4">
        <p className="text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase">
          {t("payments.summary.handOver")}
        </p>
        {/* Puede dar negativo — un día en que salió más de lo que entró — y
            entonces no hay nada que entregar: se puso plata. */}
        <p
          className={`numeric mt-1 text-3xl font-bold tracking-tight ${
            handOver < 0 ? "text-danger" : "text-ink"
          }`}
        >
          {money(handOver)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {t("payments.summary.handOverHint")}
        </p>
        <p className="numeric mt-2 border-t border-border pt-2 text-xs text-ink-muted">
          {t("payments.summary.counts")
            .replace("{payments}", String(todayTotal._count))
            .replace("{loans}", String(newLoans.length))}
        </p>
      </Card>

      {quiet ? (
        <Card className="mb-3">
          <CardBody>
            <p className="text-sm text-ink-muted">
              {t("payments.summary.nothing")}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="mb-4 grid items-start gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader title={t("payments.summary.income")} />
            <CardBody className="space-y-1.5 text-sm">
              {[
                { label: t("loans.principalPart"), value: principalPaid },
                { label: t("loans.interestPart"), value: interestPaid },
                { label: t("loans.lateFeePart"), value: lateFeePaid },
                {
                  label: t("loans.charges.installmentPart"),
                  value: chargePaid,
                },
              ].map((row) => (
                <p key={row.label} className="flex justify-between gap-3">
                  <span className="text-ink-muted">{row.label}</span>
                  <span className="numeric font-medium text-ink">
                    {money(row.value)}
                  </span>
                </p>
              ))}
              <p className="flex justify-between gap-3 border-t border-border pt-1.5">
                <span className="font-medium text-ink">
                  {t("payments.summary.collected")}
                </span>
                <span className="numeric font-bold text-positive">
                  {money(collected)}
                </span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("payments.summary.methods")} />
            <CardBody className="space-y-1.5 text-sm">
              {paidWith.length === 0 ? (
                <p className="text-ink-muted">{t("common.none")}</p>
              ) : (
                paidWith.map((row) => (
                  <p key={row.method} className="flex justify-between gap-3">
                    <span className="text-ink-muted">
                      {t(`payments.methodLabel.${row.method}`)}
                    </span>
                    <span className="numeric font-medium text-ink">
                      {money(row.amount)}
                    </span>
                  </p>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("payments.summary.movement")} />
            <CardBody className="space-y-1.5 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {t("payments.summary.lent")}
                </span>
                <span className="numeric font-medium text-ink">
                  {money(lent)}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {t("payments.summary.expenses")}
                </span>
                <span className="numeric font-medium text-ink">
                  {money(spent)}
                </span>
              </p>

              {/* Refinanciar no mueve plata y renovar solo entrega la
                  diferencia: van aparte para que nadie los cuente como
                  préstamos nuevos. */}
              {refinances.length > 0 ? (
                <p className="flex justify-between gap-3">
                  <span className="text-ink-muted">
                    {t("payments.summary.refinanced")}
                    <span className="ml-1 text-ink-subtle">
                      {t("payments.summary.carried").replace(
                        "{count}",
                        String(refinances.length),
                      )}
                    </span>
                  </span>
                  <span className="numeric font-medium text-ink">
                    {money(refinancedAmount)}
                  </span>
                </p>
              ) : null}
              {renewals.length > 0 ? (
                <p className="flex justify-between gap-3">
                  <span className="text-ink-muted">
                    {t("payments.summary.renewed")}
                    <span className="ml-1 text-ink-subtle">
                      {t("payments.summary.handedOut").replace(
                        "{count}",
                        String(renewals.length),
                      )}
                    </span>
                  </span>
                  <span className="numeric font-medium text-ink">
                    {money(renewedHandedOut)}
                  </span>
                </p>
              ) : null}

              <p className="flex justify-between gap-3 border-t border-border pt-1.5">
                <span className="font-medium text-ink">
                  {t("payments.summary.profit")}
                </span>
                <span
                  className={`numeric font-bold ${
                    profit >= 0 ? "text-positive" : "text-danger"
                  }`}
                >
                  {money(profit)}
                </span>
              </p>
              <p className="text-[0.6875rem] text-ink-subtle">
                {t("payments.summary.profitHint")}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        {payments.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={t("payments.emptyTitle")}
            hint={t("payments.emptyHint")}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("payments.receiptNumber")}</Th>
                <Th>{t("loans.customer")}</Th>
                <Th>{t("loans.code")}</Th>
                <Th>{t("payments.paidAt")}</Th>
                <Th>{t("payments.method")}</Th>
                <Th align="right">{t("common.amount")}</Th>
                <Th align="center">{t("common.status")}</Th>
                {canReverse ? <Th align="right">{""}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <Td numeric>
                    <Link
                      href={`/payments/${payment.id}`}
                      className="text-brand-strong hover:underline"
                    >
                      {payment.receiptNumber}
                    </Link>
                  </Td>
                  <Td>
                    {payment.loan.customer.firstName}{" "}
                    {payment.loan.customer.lastName}
                  </Td>
                  <Td numeric>
                    <Link
                      href={`/loans/${payment.loanId}`}
                      className="text-brand-strong hover:underline"
                    >
                      {payment.loan.code}
                    </Link>
                  </Td>
                  <Td numeric>{formatDate(payment.paidAt)}</Td>
                  <Td>{t(`payments.methodLabel.${payment.method}`)}</Td>
                  <Td align="right" numeric>
                    {money(Number(payment.amount))}
                  </Td>
                  <Td align="center">
                    <Badge
                      tone={
                        payment.status === "REVERSED" ? "danger" : "positive"
                      }
                    >
                      {t(`payments.statusLabel.${payment.status}`)}
                    </Badge>
                  </Td>
                  {canReverse ? (
                    <Td align="right">
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
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
