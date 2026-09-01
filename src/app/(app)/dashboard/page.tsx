import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/context";
import {
  getDashboardSummary,
  getDueToday,
  getRecentPayments,
  getTopArrears,
} from "@/server/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await requirePermission("dashboard.read");
  const { t, companyId, currencyCode } = context;

  const [summary, dueToday, arrears, recentPayments] = await Promise.all([
    getDashboardSummary(companyId),
    getDueToday(companyId),
    getTopArrears(companyId),
    getRecentPayments(companyId),
  ]);

  const money = (value: number) => formatCurrency(value, currencyCode);

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.greeting", {
          name: context.fullName.split(" ")[0],
        })}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.portfolio")}
          value={money(summary.portfolio)}
          hint={t("dashboard.portfolioHint")}
          icon="hand-coins"
          tone="brand"
        />
        <StatCard
          label={t("dashboard.collectedToday")}
          value={money(summary.collectedToday)}
          hint={`${t("dashboard.expectedToday")}: ${money(summary.expectedToday)}`}
          icon="receipt"
          tone="positive"
        />
        <StatCard
          label={t("dashboard.overdueAmount")}
          value={money(summary.overdueAmount)}
          hint={`${summary.overdueCustomers} ${t("dashboard.overdueCustomers").toLowerCase()}`}
          icon="alert-triangle"
          tone={summary.overdueAmount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label={t("dashboard.cashOnHand")}
          value={money(summary.cashOnHand)}
          hint={`${summary.activeLoans} ${t("dashboard.activeLoans").toLowerCase()}`}
          icon="wallet"
          tone="info"
        />
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dashboard.dueTodayTitle")} />
          {dueToday.length === 0 ? (
            <EmptyState icon="check" title={t("dashboard.noDueToday")} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("loans.customer")}</Th>
                  <Th>{t("loans.code")}</Th>
                  <Th align="right">{t("common.amount")}</Th>
                </tr>
              </thead>
              <tbody>
                {dueToday.map((row) => (
                  <tr key={row.installmentId}>
                    <Td>{row.customerName}</Td>
                    <Td>
                      <Link
                        href={`/loans/${row.loanId}`}
                        className="text-brand-strong hover:underline"
                      >
                        {row.loanCode}
                      </Link>
                    </Td>
                    <Td align="right" numeric>
                      {money(row.amount - row.paid)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader title={t("dashboard.arrearsTitle")} />
          {arrears.length === 0 ? (
            <EmptyState icon="check" title={t("dashboard.noArrears")} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("loans.customer")}</Th>
                  <Th align="center">{t("loans.daysInArrears")}</Th>
                  <Th align="right">{t("loans.outstanding")}</Th>
                </tr>
              </thead>
              <tbody>
                {arrears.map((row) => (
                  <tr key={row.loanId}>
                    <Td>
                      <Link
                        href={`/loans/${row.loanId}`}
                        className="text-brand-strong hover:underline"
                      >
                        {row.customerName}
                      </Link>
                    </Td>
                    <Td align="center">
                      <Badge
                        tone={row.daysInArrears > 30 ? "danger" : "warning"}
                      >
                        {row.daysInArrears}
                      </Badge>
                    </Td>
                    <Td align="right" numeric>
                      {money(row.outstanding)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t("dashboard.recentPaymentsTitle")} />
        {recentPayments.length === 0 ? (
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
                <Th>{t("payments.paidAt")}</Th>
                <Th align="right">{t("common.amount")}</Th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <Td numeric>{payment.receiptNumber}</Td>
                  <Td>{payment.customerName}</Td>
                  <Td numeric>{formatDateTime(payment.paidAt)}</Td>
                  <Td align="right" numeric>
                    {money(payment.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
