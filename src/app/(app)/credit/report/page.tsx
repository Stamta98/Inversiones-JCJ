import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, Card, CardBody, CardHeader, Icon, PageHeader } from "@/components/ui";
import { NOTICE_DAYS_REQUIRED } from "@/core/credit/report";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

/**
 * Reportar a un cliente a la central de riesgo.
 *
 * Se llega desde el préstamo o desde la ficha, y el formulario llega con lo
 * que ya se sabe: quién es, cuánto debe y cuántos días lleva. Lo único que
 * hay que poner es qué pasó y cuándo se le avisó.
 */
export default async function ReportCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; loanId?: string }>;
}) {
  const context = await requirePermission("credit.create");
  const { customerId, loanId } = await searchParams;
  const { t, money } = context;

  if (!customerId) notFound();

  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId: context.companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentNumber: true,
      photoUrl: true,
      city: true,
    },
  });
  if (!customer) notFound();

  const loan = loanId
    ? await db.loan.findFirst({
        where: { id: loanId, companyId: context.companyId },
        select: {
          id: true,
          code: true,
          outstanding: true,
          daysInArrears: true,
        },
      })
    : null;

  const name = `${customer.firstName} ${customer.lastName}`;

  // Sin cédula no hay con qué encontrarlo en otra oficina: se dice y se para
  // aquí, en vez de dejar llenar un formulario que no va a servir de nada.
  if (!customer.documentNumber) {
    return (
      <>
        <PageHeader title={t("credit.reportTitle").replace("{name}", name)} />
        <Card>
          <CardBody className="space-y-3">
            <Alert tone="danger">{t("credit.errors.noDocument")}</Alert>
            <Link
              href={`/customers/${customer.id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline"
            >
              <Icon name="pencil" size={16} />
              {t("customers.edit")}
            </Link>
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("credit.reportTitle").replace("{name}", name)}
        description={customer.documentNumber}
      />

      <Card>
        <CardHeader
          title={t("credit.severity")}
          description={t("credit.reportHint")}
        />
        <CardBody>
          {/* Lo que la ley pide antes de señalar a alguien, arriba del todo y
              no en letra chica al final. */}
          <Alert tone="warning" icon="alert-triangle">
            {t("credit.noticedAtHint").replace(
              "{days}",
              String(NOTICE_DAYS_REQUIRED),
            )}
          </Alert>
        </CardBody>
        <ReportForm
          customerId={customer.id}
          loanId={loan?.id ?? null}
          loanCode={loan?.code ?? null}
          name={name}
          suggestedAmount={loan ? Number(loan.outstanding) : 0}
          daysInArrears={loan?.daysInArrears ?? 0}
          currencyCode={context.currencyCode}
          locale={context.locale}
          decimalPlaces={context.decimalPlaces}
          amountHint={
            loan
              ? `${t("loans.outstanding")}: ${money(Number(loan.outstanding))}`
              : undefined
          }
        />
      </Card>
    </>
  );
}
