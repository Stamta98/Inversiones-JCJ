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
      // Ni los de lista negra ni los que están ocultos: al oculto se le deja
      // de prestar, que para eso se guardó.
      where: {
        companyId: context.companyId,
        status: { notIn: ["BLACKLISTED", "INACTIVE"] },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
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
        locale={context.locale}
        decimalPlaces={context.decimalPlaces}
        defaultCustomerId={customerId}
        customers={customers.map((customer) => ({
          id: customer.id,
          label: `${customer.code} — ${customer.firstName} ${customer.lastName}`,
        }))}
        cashBoxes={cashBoxes.map((cashBox) => ({
          id: cashBox.id,
          label: cashBox.name,
        }))}
      />
    </>
  );
}
