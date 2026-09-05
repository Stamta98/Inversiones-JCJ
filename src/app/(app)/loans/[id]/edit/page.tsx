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
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { LoanForm } from "../../new/loan-form";
import {
  CancelLoanForm,
  DeleteLoanForm,
  LoanNotesForm,
} from "./loan-edit-forms";

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
    include: { customer: true, charges: { orderBy: { createdAt: "asc" } } },
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

      {/* Cambiar las condiciones de un préstamo que ya se está cobrando
          rehace el plan: conviene decirlo antes, no después. */}
      {editableTerms && status !== "DRAFT" ? (
        <div className="mb-4">
          <Alert tone="info">{t("loans.editTermsWarning")}</Alert>
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
            rateBasis: loan.rateBasis,
            interestMethod: loan.interestMethod,
            frequency: loan.frequency,
            customIntervalDays: loan.customIntervalDays,
            nonCollectionDays: loan.nonCollectionDays,
            termCount: loan.termCount,
            firstDueDate: loan.firstDueDate.toISOString().slice(0, 10),
            lateFeeMode: loan.lateFeeMode,
            lateFeeValue: Number(loan.lateFeeValue),
            gracePeriodDays: loan.gracePeriodDays,
            charges: loan.charges.map((charge) => ({
              name: charge.name,
              amount: Number(charge.amount),
              mode: charge.mode,
            })),
          }}
          customers={[
            {
              id: loan.customerId,
              label: `${loan.customer.code} — ${loan.customer.firstName} ${loan.customer.lastName}`,
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

      {/* Con ancla: el menú del préstamo trae directo aquí. */}
      {can(context, "loans.delete") ? (
        <Card className="mt-4 max-w-2xl" id="eliminar">
          <CardHeader title={t("loans.delete")} />
          <DeleteLoanForm loanId={loan.id} />
        </Card>
      ) : null}
    </>
  );
}
