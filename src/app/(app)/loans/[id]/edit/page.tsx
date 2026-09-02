import { notFound } from "next/navigation";

import {
  Alert,
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import {
  canCancel,
  canEditTerms,
  lockedReasonKey,
} from "@/core/loans/editable";
import type { LoanStatus } from "@/core/types";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { LoanForm } from "../../new/loan-form";
import { CancelLoanForm, LoanNotesForm } from "./loan-edit-forms";

export const dynamic = "force-dynamic";

export default async function EditLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("loans.update");
  const { id } = await params;

  const loan = await db.loan.findFirst({
    where: { id, companyId: context.companyId },
    include: { customer: true },
  });

  if (!loan) notFound();

  const { t } = context;
  const status = loan.status as LoanStatus;
  const lockedReason = lockedReasonKey(status);
  const editableTerms = canEditTerms(status);

  // Un préstamo en borrador reusa el formulario de creación: es exactamente la
  // misma información y el mismo cálculo de cuotas.
  const cashBoxes = editableTerms
    ? await db.cashBox.findMany({
        where: { companyId: context.companyId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const header = (
    <PageHeader
      title={t("loans.edit")}
      description={`${loan.code} · ${loan.customer.firstName} ${loan.customer.lastName}`}
      action={
        <LinkButton
          href={`/loans/${loan.id}`}
          variant="secondary"
          icon="arrow-left"
        >
          {t("common.back")}
        </LinkButton>
      }
    />
  );

  return (
    <>
      {header}

      {lockedReason ? (
        <div className="mb-4">
          <Alert tone="warning">{t(lockedReason)}</Alert>
        </div>
      ) : null}

      {editableTerms ? (
        <LoanForm
          currencyCode={context.currencyCode}
          locale={context.locale}
          decimalPlaces={context.decimalPlaces}
          loan={{
            id: loan.id,
            customerId: loan.customerId,
            principal: Number(loan.principal),
            interestRate: Number(loan.interestRate),
            interestMethod: loan.interestMethod,
            frequency: loan.frequency,
            customIntervalDays: loan.customIntervalDays,
            nonCollectionDays: loan.nonCollectionDays,
            termCount: loan.termCount,
            firstDueDate: loan.firstDueDate.toISOString().slice(0, 10),
            lateFeeMode: loan.lateFeeMode,
            lateFeeValue: Number(loan.lateFeeValue),
            gracePeriodDays: loan.gracePeriodDays,
            notes: loan.notes,
          }}
          customers={[
            {
              id: loan.customerId,
              label: `${loan.customer.code} — ${loan.customer.firstName} ${loan.customer.lastName}`,
              payday: {
                kind: loan.customer.paydayKind,
                weekday: loan.customer.paydayWeekday,
                dayOfMonth: loan.customer.paydayDayOfMonth,
              },
            },
          ]}
          cashBoxes={cashBoxes.map((cashBox) => ({
            id: cashBox.id,
            label: cashBox.name,
          }))}
        />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader title={t("loans.editNotesOnly")} />
          <LoanNotesForm loanId={loan.id} notes={loan.notes} />
        </Card>
      )}

      {canCancel(status) ? (
        <Card className="mt-4 max-w-2xl">
          <CardHeader title={t("loans.cancel")} />
          <CancelLoanForm loanId={loan.id} />
        </Card>
      ) : null}
    </>
  );
}
