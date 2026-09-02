import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { startOfDay } from "@/core/dates";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { ReversePaymentButton } from "./reverse-payment-button";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const context = await requirePermission("payments.read");
  const dayStart = startOfDay(new Date());

  const [payments, todayTotal] = await Promise.all([
    db.payment.findMany({
      where: { companyId: context.companyId },
      include: { loan: { include: { customer: true } } },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
    db.payment.aggregate({
      where: {
        companyId: context.companyId,
        status: "POSTED",
        paidAt: { gte: dayStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const { t, money } = context;
  const canReverse = can(context, "payments.delete");

  return (
    <>
      <PageHeader title={t("payments.title")} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard
          label={t("dashboard.collectedToday")}
          value={money(Number(todayTotal._sum.amount ?? 0))}
          icon="receipt"
          tone="positive"
        />
        <StatCard
          label={t("payments.title")}
          value={String(todayTotal._count)}
          hint={t("common.today")}
        />
      </div>

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
                  <Td numeric>{payment.receiptNumber}</Td>
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
                      tone={payment.status === "REVERSED" ? "danger" : "positive"}
                    >
                      {t(`payments.statusLabel.${payment.status}`)}
                    </Badge>
                  </Td>
                  {canReverse ? (
                    <Td align="right">
                      {payment.status === "REVERSED" ? null : (
                        <ReversePaymentButton paymentId={payment.id} />
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
