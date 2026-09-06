import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/context";

import { CustomerForm } from "./customer-form";

export default async function NewCustomerPage() {
  const context = await requirePermission("customers.create");

  return (
    <>
      <PageHeader title={context.t("customers.new")} />
      <CustomerForm
        decimalPlaces={context.decimalPlaces}
        stateLabel={context.stateLabel}
        countryCode={context.countryCode}
      />
    </>
  );
}
