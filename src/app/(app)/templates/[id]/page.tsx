import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { TemplateEditor } from "../template-editor";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("templates.read");
  const { id } = await params;

  const template = await db.template.findFirst({
    where: { id, companyId: context.companyId },
  });

  if (!template) notFound();

  return (
    <>
      <PageHeader title={template.name} description={template.key} />
      <TemplateEditor
        template={{
          id: template.id,
          key: template.key,
          name: template.name,
          kind: template.kind,
          subject: template.subject,
          body: template.body,
          description: template.description,
          isSystem: template.isSystem,
        }}
      />
    </>
  );
}
