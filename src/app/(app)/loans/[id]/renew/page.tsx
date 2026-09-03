import { notFound } from "next/navigation";

import { Alert, PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { loadRenewable } from "@/server/services/renewals";

import { RenewForm } from "./renew-form";

export const dynamic = "force-dynamic";

export default async function RenewLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("loans.create");
  const { id } = await params;

  const loan = await loadRenewable(context.companyId, id);
  if (!loan) notFound();

  const cashBoxes = await db.cashBox.findMany({
    where: { companyId: context.companyId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const title = context
    .t("loans.renewal.title")
    .replace("{code}", loan.code);

  return (
    <>
      <PageHeader
        title={title}
        description={context.t("loans.renewal.subtitle")}
      />
      {/* Sin saldo no hay nada que trasladar, y el formulario no tendría qué
          calcular: se dice por qué en vez de mostrarlo roto. */}
      {loan.outstanding <= 0 ? (
        <Alert tone="info">{context.t("loans.errors.noBalance")}</Alert>
      ) : (
        <RenewForm
          loan={{
            id: loan.id,
            code: loan.code,
            customerName: loan.customerName,
            outstanding: loan.outstanding,
            principal: loan.principal,
            interestRate: loan.interestRate,
            rateBasis: loan.rateBasis,
            interestMethod: loan.interestMethod,
            frequency: loan.frequency,
            customIntervalDays: loan.customIntervalDays,
            nonCollectionDays: loan.nonCollectionDays,
            termCount: loan.termCount,
            lateFeeMode: loan.lateFeeMode,
            lateFeeValue: loan.lateFeeValue,
            gracePeriodDays: loan.gracePeriodDays,
          }}
          cashBoxes={cashBoxes.map((cashBox) => ({
            id: cashBox.id,
            label: cashBox.name,
          }))}
          currencyCode={context.currencyCode}
          locale={context.locale}
          decimalPlaces={context.decimalPlaces}
        />
      )}
    </>
  );
}
