import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/format";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Standard arrears buckets used by every collection report. */
const ARREARS_BUCKETS = [
  { label: "1 a 7 días", min: 1, max: 7 },
  { label: "8 a 15 días", min: 8, max: 15 },
  { label: "16 a 30 días", min: 16, max: 30 },
  { label: "31 a 60 días", min: 31, max: 60 },
  { label: "Más de 60 días", min: 61, max: Number.MAX_SAFE_INTEGER },
];

export default async function ReportsPage() {
  const context = await requirePermission("reports.read");

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [portfolio, arrearsLoans, collected, expenses, interest, byCollector] =
    await Promise.all([
      db.loan.aggregate({
        where: {
          companyId: context.companyId,
          status: { in: ["ACTIVE", "IN_ARREARS"] },
        },
        _sum: { outstanding: true, principal: true },
        _count: true,
      }),
      db.loan.findMany({
        where: { companyId: context.companyId, status: "IN_ARREARS" },
        select: { daysInArrears: true, outstanding: true },
      }),
      db.payment.aggregate({
        where: {
          companyId: context.companyId,
          status: "POSTED",
          paidAt: { gte: monthStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { companyId: context.companyId, spentAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.paymentAllocation.aggregate({
        where: {
          payment: {
            companyId: context.companyId,
            status: "POSTED",
            paidAt: { gte: monthStart },
          },
        },
        _sum: { interestAmount: true, lateFeeAmount: true },
      }),
      db.payment.groupBy({
        by: ["collectedById"],
        where: {
          companyId: context.companyId,
          status: "POSTED",
          paidAt: { gte: monthStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  const collectorIds = byCollector
    .map((row) => row.collectedById)
    .filter((id): id is string => id !== null);

  const collectors = collectorIds.length
    ? await db.user.findMany({
        where: { id: { in: collectorIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const collectorNames = new Map(
    collectors.map((user) => [user.id, user.fullName]),
  );

  const { t, currencyCode } = context;
  const money = (value: number) => formatCurrency(value, currencyCode);

  const interestEarned =
    Number(interest._sum.interestAmount ?? 0) +
    Number(interest._sum.lateFeeAmount ?? 0);
  const expenseTotal = Number(expenses._sum.amount ?? 0);

  const buckets = ARREARS_BUCKETS.map((bucket) => {
    const loans = arrearsLoans.filter(
      (loan) =>
        loan.daysInArrears >= bucket.min && loan.daysInArrears <= bucket.max,
    );
    return {
      label: bucket.label,
      count: loans.length,
      amount: loans.reduce((sum, loan) => sum + Number(loan.outstanding), 0),
    };
  });

  const arrearsTotal = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const portfolioTotal = Number(portfolio._sum.outstanding ?? 0);

  return (
    <>
      <PageHeader
        title={t("reports.title")}
        description={`${t("reports.period")}: ${t("common.thisMonth")}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("reports.portfolio")}
          value={money(portfolioTotal)}
          hint={`${formatNumber(portfolio._count)} ${t("loans.title").toLowerCase()}`}
          icon="hand-coins"
          tone="brand"
        />
        <StatCard
          label={t("reports.collection")}
          value={money(Number(collected._sum.amount ?? 0))}
          hint={`${formatNumber(collected._count)} ${t("payments.title").toLowerCase()}`}
          icon="receipt"
          tone="positive"
        />
        <StatCard
          label={t("dashboard.interestEarned")}
          value={money(interestEarned)}
          hint={`${t("expenses.title")}: ${money(expenseTotal)}`}
          icon="bar-chart"
          tone="info"
        />
        <StatCard
          label={t("reports.profitability")}
          value={money(interestEarned - expenseTotal)}
          hint={t("common.thisMonth")}
          icon="trending-down"
          tone={interestEarned - expenseTotal >= 0 ? "positive" : "danger"}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("reports.arrears")}
            description={
              portfolioTotal > 0
                ? `${((arrearsTotal / portfolioTotal) * 100).toFixed(1)}% ${t("common.of")} ${t("reports.portfolio").toLowerCase()}`
                : undefined
            }
          />
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("loans.daysInArrears")}</Th>
                <Th align="center">{t("loans.title")}</Th>
                <Th align="right">{t("loans.outstanding")}</Th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.label}>
                  <Td>{bucket.label}</Td>
                  <Td align="center" numeric>
                    {bucket.count}
                  </Td>
                  <Td align="right" numeric>
                    {money(bucket.amount)}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-medium">{t("common.total")}</Td>
                <Td align="center" numeric className="font-medium">
                  {arrearsLoans.length}
                </Td>
                <Td align="right" numeric className="font-medium">
                  {money(arrearsTotal)}
                </Td>
              </tr>
            </tbody>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title={t("reports.productivity")} />
          {byCollector.length === 0 ? (
            <EmptyState icon="bar-chart" title={t("common.empty")} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("payments.collectedBy")}</Th>
                  <Th align="center">{t("payments.title")}</Th>
                  <Th align="right">{t("common.total")}</Th>
                </tr>
              </thead>
              <tbody>
                {byCollector
                  .sort(
                    (a, b) =>
                      Number(b._sum.amount ?? 0) - Number(a._sum.amount ?? 0),
                  )
                  .map((row) => (
                    <tr key={row.collectedById ?? "none"}>
                      <Td>
                        {row.collectedById
                          ? (collectorNames.get(row.collectedById) ?? "—")
                          : "—"}
                      </Td>
                      <Td align="center" numeric>
                        {row._count}
                      </Td>
                      <Td align="right" numeric>
                        {money(Number(row._sum.amount ?? 0))}
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
