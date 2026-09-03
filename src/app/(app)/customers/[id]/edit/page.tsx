import { notFound } from "next/navigation";

import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { can, requirePermission } from "@/server/auth/context";
import { customerDeletionSummary } from "@/server/services/customers";
import { db } from "@/server/db";

import { CustomerForm } from "../../new/customer-form";
import { DeleteCustomer } from "./delete-customer";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.update");
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, companyId: context.companyId },
    include: {
      references: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!customer) notFound();

  // Qué se llevaría por delante borrarlo, para poder decirlo antes de preguntar.
  const summary = await customerDeletionSummary(context.companyId, customer.id);

  const documentUrl = (kind: "ID_FRONT" | "ID_BACK") =>
    customer.attachments.find((attachment) => attachment.kind === kind)?.url ??
    null;

  return (
    <>
      <PageHeader
        title={context.t("customers.edit")}
        description={`${customer.firstName} ${customer.lastName} · ${customer.code}`}
        action={
          <LinkButton
            href={`/customers/${customer.id}`}
            variant="secondary"
            icon="arrow-left"
          >
            {context.t("common.back")}
          </LinkButton>
        }
      />

      <CustomerForm
        stateLabel={context.stateLabel}
        decimalPlaces={context.decimalPlaces}
        customer={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          documentType: customer.documentType,
          documentNumber: customer.documentNumber,
          birthDate: customer.birthDate
            ? customer.birthDate.toISOString().slice(0, 10)
            : null,
          gender: customer.gender,
          nationality: customer.nationality,
          email: customer.email,
          phone: customer.phone,
          mobilePhone: customer.mobilePhone,
          address: customer.address,
          neighborhood: customer.neighborhood,
          landmark: customer.landmark,
          city: customer.city,
          state: customer.state,
          employmentType: customer.employmentType,
          occupation: customer.occupation,
          employerName: customer.employerName,
          workAddress: customer.workAddress,
          workNeighborhood: customer.workNeighborhood,
          workLandmark: customer.workLandmark,
          // Decimal no cruza a un componente de cliente; se envía como número.
          monthlyIncome:
            customer.monthlyIncome === null
              ? null
              : Number(customer.monthlyIncome),
          paydayKind: customer.paydayKind,
          paydayWeekday: customer.paydayWeekday,
          paydayDayOfMonth: customer.paydayDayOfMonth,
          vehiclePlate: customer.vehiclePlate,
          notes: customer.notes,
          photoUrl: customer.photoUrl,
          latitude: customer.latitude,
          longitude: customer.longitude,
          workLatitude: customer.workLatitude,
          workLongitude: customer.workLongitude,
          idFrontUrl: documentUrl("ID_FRONT"),
          idBackUrl: documentUrl("ID_BACK"),
          references: customer.references.map((reference) => ({
            fullName: reference.fullName,
            relationship: reference.relationship,
            phone: reference.phone,
            address: reference.address,
          })),
        }}
      />

      {can(context, "customers.delete") && summary ? (
        <Card className="mt-4 max-w-2xl">
          <CardHeader title={context.t("customers.delete")} />
          <DeleteCustomer
            customerId={customer.id}
            loans={summary.loans}
            outstanding={summary.outstanding}
            paid={summary.paid}
            money={{
              outstanding: context.money(summary.outstanding),
              paid: context.money(summary.paid),
            }}
          />
        </Card>
      ) : null}
    </>
  );
}
