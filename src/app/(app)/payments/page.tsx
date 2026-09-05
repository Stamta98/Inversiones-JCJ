import Link from "next/link";

import {
  Badge,
  Button,
  LinkButton,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { addDays, dayParam, parseDay, startOfDay } from "@/core/dates";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { DeletePaymentButton } from "./delete-payment-button";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const context = await requirePermission("payments.read");
  const { date } = await searchParams;

  // El resumen es de un día, y ese día se escoge. Sin fecha, o con una que no
  // existe, es el de hoy.
  const today = startOfDay(new Date());
  const dayStart = parseDay(date) ?? today;
  // "Hoy" tiene dos extremos. Con solo el de abajo, un cobro o un préstamo
  // fechado adelante entraba en la cuenta del día y la inflaba.
  const dayEnd = addDays(dayStart, 1);
  const day = { gte: dayStart, lt: dayEnd };
  const isToday = dayStart.getTime() === today.getTime();
  const selected = dayParam(dayStart);

  // Un traspaso de refinanciación se guarda como cobro para saldar el préstamo
  // viejo, pero esa plata nunca entró a la caja: contarla en el día sería
  // pedirle al cobrador que entregue lo que nadie le dio.
  const collectedToday = {
    companyId: context.companyId,
    status: "POSTED" as const,
    method: { not: "REFINANCE" as const },
    paidAt: day,
  };

  const [
    payments,
    todayTotal,
    applied,
    byMethod,
    disbursed,
    chargesAtDisbursement,
    chargesInPayments,
    expenses,
    newLoans,
    carried,
  ] = await Promise.all([
    db.payment.findMany({
      where: { companyId: context.companyId, paidAt: day },
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
        createdAt: day,
      },
      _sum: { amount: true },
      _count: true,
    }),
    // El cargo que se le descuenta al cliente al entregarle la plata vuelve a
    // la caja el mismo día. Sin contarlo, el resumen dice que salieron los
    // 200.000 completos cuando salieron 190.000, y la ganancia se queda sin
    // los 10.000 que el negocio sí se ganó.
    db.cashMovement.aggregate({
      where: {
        cashBox: { companyId: context.companyId },
        kind: "CHARGE_COLLECTED",
        createdAt: day,
      },
      _sum: { amount: true },
      _count: true,
    }),
    // El cargo que se reparte entre las cuotas no llega de una: va entrando
    // con cada abono. Agrupado por abono para poder decir cuántos fueron.
    db.paymentAllocation.groupBy({
      by: ["paymentId"],
      where: { payment: collectedToday, chargeAmount: { gt: 0 } },
      _sum: { chargeAmount: true },
    }),
    // El gasto se cuenta desde el gasto, no desde la caja: uno registrado sin
    // caja igual salió del bolsillo, y el detalle lo lista aunque el cuadro
    // dijera cero.
    db.expense.aggregate({
      where: { companyId: context.companyId, spentAt: day },
      _sum: { amount: true },
      _count: true,
    }),
    db.loan.findMany({
      where: {
        companyId: context.companyId,
        disbursedAt: day,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        code: true,
        origin: true,
        principal: true,
        parentLoanId: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { disbursedAt: "desc" },
    }),
    // Lo que se trasladó de cada préstamo viejo al nuevo, para saber qué
    // parte de una renovación fue plata entregada y qué parte fue traspaso.
    db.payment.groupBy({
      by: ["loanId"],
      where: {
        companyId: context.companyId,
        status: "POSTED",
        method: "REFINANCE",
        paidAt: day,
      },
      _sum: { amount: true },
    }),
  ]);

  const { t, money } = context;
  const canReverse = can(context, "payments.delete");

  // La caja guarda las salidas en negativo; aquí se leen como lo que son.
  const collected = Number(todayTotal._sum.amount ?? 0);
  const lent = Math.abs(Number(disbursed._sum.amount ?? 0));
  // Lo que se le descontó al cliente al entregarle: salió con el desembolso y
  // volvió de una, así que es plata que se quedó en la caja.
  const chargesTaken = Math.abs(Number(chargesAtDisbursement._sum.amount ?? 0));
  const spent = Math.abs(Number(expenses._sum.amount ?? 0));
  const handOver = collected + chargesTaken - lent - spent;

  const principalPaid = Number(applied._sum.principalAmount ?? 0);
  const interestPaid = Number(applied._sum.interestAmount ?? 0);
  const lateFeePaid = Number(applied._sum.lateFeeAmount ?? 0);
  const chargePaid = Number(applied._sum.chargeAmount ?? 0);
  // Lo cobrado que no alcanzó a entrar en ninguna cuota, porque el cliente
  // pagó más de lo que debía.
  const surplus =
    collected - (principalPaid + interestPaid + lateFeePaid + chargePaid);
  // Lo que los cargos dejaron en el día, venga como venga: el que se
  // descontó al entregar la plata y la parte de cargo de lo que se cobró.
  // Las dos son plata que entró hoy por el mismo concepto.
  const chargesEarned = chargesTaken + chargePaid;
  const chargesCount = chargesAtDisbursement._count + chargesInPayments.length;

  // Lo que deja el día: el capital vuelve, no se gana. Los gastos sí salen.
  const profit = interestPaid + lateFeePaid + chargePaid + chargesTaken - spent;

  // Refinanciar no mueve plata: traslada un saldo. Renovar traslada el saldo
  // y entrega la diferencia. Ninguna de las dos es "prestar" lo que dice el
  // monto del préstamo nuevo.
  const carriedFor = new Map(
    carried.map((row) => [row.loanId, Number(row._sum.amount ?? 0)]),
  );
  const carriedOn = (parentLoanId: string | null) =>
    parentLoanId ? (carriedFor.get(parentLoanId) ?? 0) : 0;

  const fresh = newLoans.filter((loan) => loan.origin === "NEW");
  const freshAmount = fresh.reduce(
    (total, loan) => total + Number(loan.principal),
    0,
  );
  const refinances = newLoans.filter((loan) => loan.origin === "REFINANCE");
  const renewals = newLoans.filter((loan) => loan.origin === "RENEWAL");
  const refinancedAmount = refinances.reduce(
    (total, loan) => total + carriedOn(loan.parentLoanId),
    0,
  );
  const renewedHandedOut = renewals.reduce(
    (total, loan) =>
      total +
      Math.max(0, Number(loan.principal) - carriedOn(loan.parentLoanId)),
    0,
  );

  // Cada préstamo del día con su cliente y lo que significó en plata: uno
  // nuevo es lo prestado, una renovación lo que se entregó encima y una
  // refinanciación lo que se trasladó sin mover un peso.
  const loansToday = newLoans.map((loan) => {
    const moved = carriedOn(loan.parentLoanId);
    const amount =
      loan.origin === "REFINANCE"
        ? moved
        : loan.origin === "RENEWAL"
          ? Math.max(0, Number(loan.principal) - moved)
          : Number(loan.principal);
    return {
      id: loan.id,
      code: loan.code,
      name: `${loan.customer.firstName} ${loan.customer.lastName}`,
      kind:
        loan.origin === "REFINANCE"
          ? t("loans.renewal.kindMenu.REFINANCE")
          : loan.origin === "RENEWAL"
            ? t("loans.renewal.kindMenu.RENEWAL")
            : t("payments.summary.kindNew"),
      note:
        loan.origin === "REFINANCE"
          ? t("payments.summary.amountCarried")
          : loan.origin === "RENEWAL"
            ? t("payments.summary.amountHandedOut")
            : t("payments.summary.amountLent"),
      amount,
    };
  });

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
      <PageHeader
        title={t("payments.summary.title")}
        description={
          isToday
            ? `${t("payments.summary.dayToday")} · ${formatDate(dayStart)}`
            : formatDate(dayStart)
        }
      />

      {/* Qué día se está mirando. Es un formulario de los de toda la vida: sin
          JavaScript también cambia de día. */}
      <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
        <span className="min-w-40 flex-1">
          <label
            htmlFor="date"
            className="mb-1 block text-xs font-medium text-ink-muted"
          >
            {t("payments.summary.day")}
          </label>
          <Input id="date" name="date" type="date" defaultValue={selected} />
        </span>
        <Button type="submit" variant="secondary" icon="search">
          {t("payments.summary.show")}
        </Button>
        <span className="flex gap-1.5">
          <LinkButton href="/payments" variant="ghost" size="sm">
            {t("payments.summary.dayToday")}
          </LinkButton>
          <LinkButton
            href={`/payments?date=${dayParam(addDays(today, -1))}`}
            variant="ghost"
            size="sm"
          >
            {t("payments.summary.dayYesterday")}
          </LinkButton>
        </span>
      </form>

      {/* Lo que se movió hoy, cada cosa en su cuadro con su monto y cuántas
          fueron: ninguna se entiende sumada con las otras. Lo cobrado va
          arriba y de lado a lado porque es de donde sale todo lo demás, y los
          cargos abajo, cerrando con lo que el día dejó de más. */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        {[
          {
            label: t("payments.summary.collected"),
            kind: "COLLECTED",
            icon: "credit-card" as const,
            value: collected,
            count: todayTotal._count,
            one: "payments.summary.countPaymentsOne",
            many: "payments.summary.countPayments",
            // Blanco y con borde marcado: es un total, no una categoría más.
            // Los cuadros de color son las cosas que se cuentan aparte.
            box: "border-border-strong bg-surface",
            text: "text-ink",
            wide: true,
          },
          {
            label: t("payments.summary.tileLoans"),
            kind: "NEW",
            icon: "hand-coins" as const,
            value: freshAmount,
            count: fresh.length,
            one: "payments.summary.countLoansOne",
            many: "payments.summary.countLoans",
            box: "border-info-soft bg-info-soft/60",
            text: "text-info",
            wide: false,
          },
          {
            label: t("loans.renewal.kindMenu.RENEWAL"),
            kind: "RENEWAL",
            icon: "refresh" as const,
            value: renewedHandedOut,
            count: renewals.length,
            one: "payments.summary.countRenewalsOne",
            many: "payments.summary.countRenewals",
            box: "border-positive-soft bg-positive-soft/60",
            text: "text-positive",
            wide: false,
          },
          {
            label: t("loans.renewal.kindMenu.REFINANCE"),
            kind: "REFINANCE",
            icon: "file-text" as const,
            value: refinancedAmount,
            count: refinances.length,
            one: "payments.summary.countRefinancesOne",
            many: "payments.summary.countRefinances",
            box: "border-warning-soft bg-warning-soft/60",
            text: "text-warning",
            wide: false,
          },
          {
            label: t("payments.summary.expenses"),
            kind: "EXPENSE",
            icon: "receipt" as const,
            value: spent,
            count: expenses._count,
            one: "payments.summary.countExpensesOne",
            many: "payments.summary.countExpenses",
            box: "border-danger-soft bg-danger-soft/60",
            text: "text-danger",
            wide: false,
          },
          // Los cargos van solos en la última fila y ocupan el ancho: son
          // cinco cuadros en dos columnas y dejar uno a medias, con el hueco
          // al lado, se ve como si faltara algo.
          {
            label: t("payments.summary.tileCharges"),
            kind: "CHARGE",
            icon: "wallet" as const,
            value: chargesEarned,
            count: chargesCount,
            one: "payments.summary.countChargesOne",
            many: "payments.summary.countCharges",
            box: "border-brand-soft bg-brand-soft/60",
            text: "text-brand-strong",
            wide: true,
          },
        ].map((tile) => (
          <Link
            key={tile.label}
            href={`/payments/day?kind=${tile.kind}&date=${selected}`}
            className={`rounded-[--radius-card] border p-3 transition-shadow hover:shadow-md ${tile.box} ${
              tile.wide ? "col-span-2" : ""
            }`}
          >
            <p
              className={`flex items-center gap-1.5 text-sm font-semibold ${tile.text}`}
            >
              <Icon name={tile.icon} size={16} />
              {tile.label}
            </p>
            <p className="numeric mt-1 text-xl font-bold tracking-tight text-ink">
              {money(tile.value)}
            </p>
            <p className="mt-0.5 flex items-center gap-0.5 text-[0.6875rem] text-ink-muted">
              {tile.count === 0
                ? t("payments.summary.none")
                : t(tile.count === 1 ? tile.one : tile.many).replace(
                    "{count}",
                    String(tile.count),
                  )}
              <Icon name="chevron-right" size={12} />
            </p>
          </Link>
        ))}
      </div>

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
              {t(
                isToday
                  ? "payments.summary.nothing"
                  : "payments.summary.nothingThatDay",
              )}
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
                // Cuando alguien paga más de lo que debía, ese sobrante no
                // entró a ninguna cuota. Sin esta línea las cuatro de arriba
                // no suman el total y la cuenta del día parece cuadrada
                // cuando no lo está.
                ...(surplus > 0
                  ? [{ label: t("payments.unapplied"), value: surplus }]
                  : []),
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
              {/* Lo que se le descontó al cliente al entregarle: no entra por
                  un abono, así que sin este renglón no aparecía en ninguna
                  parte y la resta de arriba quedaba coja. */}
              {chargesTaken > 0 ? (
                <p className="flex justify-between gap-3">
                  <span className="text-ink-muted">
                    {t("payments.summary.chargesTaken")}
                  </span>
                  <span className="numeric font-medium text-positive">
                    {money(chargesTaken)}
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

      {/* A quién se le prestó hoy y cuánto. Sin los nombres, "prestado
          $680.000" no dice a quién hay que ir a cobrarle mañana. */}
      {loansToday.length > 0 ? (
        <Card className="mb-4">
          <CardHeader title={t("payments.summary.loansOfDay")} />
          <CardBody className="divide-y divide-border py-0">
            {loansToday.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <Link
                    href={`/loans/${loan.id}`}
                    className="block truncate text-sm font-semibold text-ink hover:underline"
                  >
                    {loan.name}
                  </Link>
                  <span className="numeric block truncate text-xs text-ink-muted">
                    {loan.code} · {loan.kind}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="numeric block text-sm font-bold text-ink">
                    {money(loan.amount)}
                  </span>
                  <span className="block text-[0.6875rem] text-ink-subtle">
                    {loan.note}
                  </span>
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

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
