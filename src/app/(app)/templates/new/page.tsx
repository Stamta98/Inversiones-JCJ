import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/context";

import { TemplateEditor } from "../template-editor";

export default async function NewTemplatePage() {
  const context = await requirePermission("templates.create");

  return (
    <>
      <PageHeader title={context.t("templates.new")} />
      <TemplateEditor />
    </>
  );
}
