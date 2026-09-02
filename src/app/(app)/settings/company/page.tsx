import { LinkButton, PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { CompanyForm } from "./company-form";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const context = await requirePermission("settings.update");

  const company = await db.company.findUniqueOrThrow({
    where: { id: context.companyId },
    select: {
      name: true,
      legalName: true,
      taxId: true,
      email: true,
      phone: true,
      address: true,
      country: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      logoUrl: true,
      currencyCode: true,
      decimalPlaces: true,
      locale: true,
      timezone: true,
    },
  });

  return (
    <>
      <PageHeader
        title={context.t("settings.companyTitle")}
        description={context.t("settings.companyHint")}
        action={
          <LinkButton href="/settings" variant="secondary" icon="arrow-left">
            {context.t("common.back")}
          </LinkButton>
        }
      />
      <CompanyForm company={company} />
    </>
  );
}
