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
import { ShareDocument } from "@/components/ui/share-document";
import { addDays, dayParam, parseDay, startOfDay } from "@/core/dates";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { loadDaySummary } from "@/server/services/day-summary";

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
  const isToday = dayStart.getTime() === today.getTime();
  const selected = dayParam(dayStart);

  const summary = await loadDaySummary(context.companyId, dayStart);

  const { t, money } = context;
  const canReverse = can(context, "payments.delete");

  const {
    collected,
    principalPaid,
    interestPaid,
    lateFeePaid,
    chargePaid,
    surplus,
    lent,
    freshAmount,
    freshCount,
    renewedHandedOut,
    renewalCount,
    refinancedAmount,
    refinanceCount,
    chargesTaken,
    chargesDeducted,
    chargesApartTaken,
    chargesCount,
    spent,
    expenseCount,
    handOver,
    profit,
    paymentCount,
    loanCount,
    paidWith,
    payments,
    quiet,
  } = summary;

  const noPayments = paymentCount === 0;
  const incomeRows = [
    { label: t("loans.principalPart"), value: principalPaid },
    { label: t("loans.interestPart"), value: interestPaid },
    { label: t("loans.lateFeePart"), value: lateFeePaid },
    { label: t("loans.charges.installmentPart"), value: chargePaid },
    ...(surplus > 0
      ? [{ label: t("payments.unapplied"), value: surplus }]
      : []),
  ];

  // Cada préstamo del día con lo que significó en plata: uno nuevo es lo
  // prestado, una renovación lo que se entregó encima y una refinanciación lo
  // que se trasladó sin mover un peso.
  const loansToday = summary.loans.map((loan) => ({
    ...loan,
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
  }));

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

      {/* Los seis cuadros del día, todos del mismo tamaño y en dos columnas.
          El orden lo manda la lectura, no la importancia: lo cobrado y lo
          prestado arriba, que es de lo que se habla; renovar y refinanciar en
          el medio, que son la misma cosa mirada de dos maneras; y abajo los
          cargos y los gastos, que es lo de más y lo de menos del día. */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        {[
          {
            label: t("payments.summary.collected"),
            kind: "COLLECTED",
            icon: "credit-card" as const,
            value: collected,
            count: paymentCount,
            one: "payments.summary.countPaymentsOne",
            many: "payments.summary.countPayments",
            box: "border-border-strong bg-surface",
            text: "text-ink",
          },
          {
            label: t("payments.summary.tileLoans"),
            kind: "NEW",
            icon: "hand-coins" as const,
            value: freshAmount,
            count: freshCount,
            one: "payments.summary.countLoansOne",
            many: "payments.summary.countLoans",
            box: "border-info-soft bg-info-soft/60",
            text: "text-info",
          },
          {
            label: t("loans.renewal.kindMenu.RENEWAL"),
            kind: "RENEWAL",
            icon: "refresh" as const,
            value: renewedHandedOut,
            count: renewalCount,
            one: "payments.summary.countRenewalsOne",
            many: "payments.summary.countRenewals",
            box: "border-positive-soft bg-positive-soft/60",
            text: "text-positive",
          },
          {
            label: t("loans.renewal.kindMenu.REFINANCE"),
            kind: "REFINANCE",
            icon: "file-text" as const,
            value: refinancedAmount,
            count: refinanceCount,
            one: "payments.summary.countRefinancesOne",
            many: "payments.summary.countRefinances",
            box: "border-warning-soft bg-warning-soft/60",
            text: "text-warning",
          },
          {
            label: t("payments.summary.tileCharges"),
            kind: "CHARGE",
            icon: "wallet" as const,
            value: chargesTaken,
            count: chargesCount,
            one: "payments.summary.countChargesOne",
            many: "payments.summary.countCharges",
            box: "border-brand-soft bg-brand-soft/60",
            text: "text-brand-strong",
          },
          {
            label: t("payments.summary.expenses"),
            kind: "EXPENSE",
            icon: "receipt" as const,
            value: spent,
            count: expenseCount,
            one: "payments.summary.countExpensesOne",
            many: "payments.summary.countExpenses",
            box: "border-danger-soft bg-danger-soft/60",
            text: "text-danger",
          },
        ].map((tile) => (
          <Link
            key={tile.label}
            href={`/payments/day?kind=${tile.kind}&date=${selected}`}
            className={`rounded-[--radius-card] border p-3 transition-shadow hover:shadow-md ${tile.box}`}
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
          {/* «1 préstamos» no se dice. */}
          {t("payments.summary.counts")
            .replace(
              "{payments} abonos",
              paymentCount === 1
                ? t("payments.summary.countsPaymentOne")
                : `${paymentCount} abonos`,
            )
            .replace(
              "{loans} préstamos",
              loanCount === 1
                ? t("payments.summary.countsLoanOne")
                : `${loanCount} préstamos`,
            )}
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
            <CardHeader
              title={t("payments.summary.income")}
              description={t("payments.summary.incomeHint")}
            />
            <CardBody className="space-y-1.5 text-sm">
              {/* Cuatro ceros en fila se leen como si faltara algo, y llevan a
                  buscar aquí el cargo que se descontó al entregar, que no es
                  de aquí. Sin abonos se dice con palabras. */}
              {noPayments ? (
                <p className="text-ink-muted">
                  {t(
                    isToday
                      ? "payments.summary.incomeNone"
                      : "payments.summary.incomeNoneThatDay",
                  )}
                </p>
              ) : (
                incomeRows.map((row) => (
                  <p key={row.label} className="flex justify-between gap-3">
                    <span className="text-ink-muted">{row.label}</span>
                    <span className="numeric font-medium text-ink">
                      {money(row.value)}
                    </span>
                  </p>
                ))
              )}
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
            <CardHeader
              title={t("payments.summary.methods")}
              description={t("payments.summary.methodsHint")}
            />
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
            <CardHeader
              title={t("payments.summary.movement")}
              description={t("payments.summary.movementHint")}
            />
            <CardBody className="space-y-1.5 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {t("payments.summary.lent")}
                </span>
                <span className="numeric font-medium text-ink">
                  {money(lent)}
                </span>
              </p>
              {/* Los cargos que entraron por fuera de los abonos, cada uno
                  por su nombre: el que se netea al entregar la plata y el que
                  se le cobró al cliente aparte. Juntos en un solo renglón que
                  decía «al entregar», la mitad de la cifra era mentira. */}
              {[
                {
                  label: t("payments.summary.chargesTaken"),
                  value: chargesDeducted,
                },
                {
                  label: t("payments.summary.chargesApartLine"),
                  value: chargesApartTaken,
                },
              ]
                .filter((row) => row.value > 0)
                .map((row) => (
                  <p key={row.label} className="flex justify-between gap-3">
                    <span className="text-ink-muted">{row.label}</span>
                    <span className="numeric font-medium text-positive">
                      {money(row.value)}
                    </span>
                  </p>
                ))}
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

      {/* El cierre del día en una hoja. El cobrador cuadra en la calle y le
          manda el papel al dueño por WhatsApp sin tener que dictárselo. */}
      <Card className="mb-4">
        <CardHeader
          title={t("payments.summary.pdfTitle")}
          description={t("payments.summary.pdfHint")}
        />
        <CardBody>
          <ShareDocument
            url={`/api/payments/summary/pdf?date=${selected}`}
            fileName={`resumen-${selected}.pdf`}
            mimeType="application/pdf"
            message={t("payments.summary.pdfMessage")
              .replace("{day}", formatDate(dayStart))
              .replace("{company}", context.companyName)}
            phone={null}
            shareLabel={t("payments.summary.pdfShare")}
            downloadLabel={t("payments.summary.pdfDownload")}
            busyLabel={t("payments.sharing")}
            fallbackLabel={t("payments.shareFallback")}
            downloadIcon="file-text"
          />
        </CardBody>
      </Card>

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
                  <Td>{payment.name}</Td>
                  <Td numeric>
                    <Link
                      href={`/loans/${payment.loanId}`}
                      className="text-brand-strong hover:underline"
                    >
                      {payment.loanCode}
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
