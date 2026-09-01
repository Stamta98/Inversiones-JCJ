import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const context = await requirePermission("templates.read");

  const templates = await db.template.findMany({
    where: { companyId: context.companyId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const { t } = context;

  return (
    <>
      <PageHeader
        title={t("templates.title")}
        description={t("modules.templates.description")}
        action={
          can(context, "templates.create") ? (
            <LinkButton href="/templates/new" icon="plus">
              {t("templates.new")}
            </LinkButton>
          ) : null
        }
      />

      <Card>
        {templates.length === 0 ? (
          <EmptyState
            icon="file-text"
            title={t("templates.emptyTitle")}
            hint={t("templates.emptyHint")}
            action={
              can(context, "templates.create") ? (
                <LinkButton href="/templates/new" icon="plus" size="sm">
                  {t("templates.new")}
                </LinkButton>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("templates.name")}</Th>
                <Th>{t("templates.key")}</Th>
                <Th>{t("templates.kind")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <Td>
                    <Link
                      href={`/templates/${template.id}`}
                      className="text-brand-strong hover:underline"
                    >
                      {template.name}
                    </Link>
                    {template.description ? (
                      <span className="block text-xs text-ink-subtle">
                        {template.description}
                      </span>
                    ) : null}
                  </Td>
                  <Td numeric>{template.key}</Td>
                  <Td>{t(`templates.kindLabel.${template.kind}`)}</Td>
                  <Td align="center">
                    <Badge tone={template.isActive ? "positive" : "neutral"}>
                      {template.isActive
                        ? t("common.enabled")
                        : t("common.disabled")}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
