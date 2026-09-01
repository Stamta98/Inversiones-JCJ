import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { LoanForm } from "./loan-form";

export const dynamic = "force-dynamic";

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const context = await requirePermission("loans.create");
  const { customerId } = await searchParams;

  const [customers, cashBoxes] = await Promise.all([
    db.customer.findMany({
      where: { companyId: context.companyId, status: { not: "BLACKLISTED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        paydayKind: true,
        paydayWeekday: true,
        paydayDayOfMonth: true,
      },
      take: 500,
    }),
    db.cashBox.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader title={context.t("loans.new")} />
      <LoanForm
        currencyCode={context.currencyCode}
        defaultCustomerId={customerId}
        customers={customers.map((customer) => ({
          id: customer.id,
          label: `${customer.code} — ${customer.firstName} ${customer.lastName}`,
          payday: {
            kind: customer.paydayKind,
            weekday: customer.paydayWeekday,
            dayOfMonth: customer.paydayDayOfMonth,
          },
        }))}
        cashBoxes={cashBoxes.map((cashBox) => ({
          id: cashBox.id,
          label: cashBox.name,
        }))}
      />
    </>
  );
}
