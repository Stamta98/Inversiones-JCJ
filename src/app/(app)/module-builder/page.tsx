import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { EntityForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function ModuleBuilderPage() {
  const context = await requirePermission("moduleBuilder.read");

  const entities = await db.customEntity.findMany({
    where: { companyId: context.companyId },
    include: { _count: { select: { fields: true, records: true } } },
    orderBy: { sortOrder: "asc" },
  });

  const { t } = context;

  return (
    <>
      <PageHeader
        title={t("moduleBuilder.title")}
        description={t("moduleBuilder.subtitle")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("moduleBuilder.entities")} />
          {entities.length === 0 ? (
            <EmptyState
              icon="blocks"
              title={t("moduleBuilder.emptyTitle")}
              hint={t("moduleBuilder.emptyHint")}
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("moduleBuilder.entityName")}</Th>
                  <Th>{t("moduleBuilder.extendsKey")}</Th>
                  <Th align="center">{t("moduleBuilder.fields")}</Th>
                  <Th align="center">{t("moduleBuilder.records")}</Th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <tr key={entity.id}>
                    <Td>
                      <Link
                        href={`/module-builder/${entity.key}`}
                        className="text-brand-strong hover:underline"
                      >
                        {entity.pluralName}
                      </Link>
                      <span className="block text-xs text-ink-subtle">
                        {entity.key}
                      </span>
                    </Td>
                    <Td>
                      {entity.extendsKey ? (
                        <Badge tone="info">
                          {es.moduleBuilder.extendable[
                            entity.extendsKey as keyof typeof es.moduleBuilder.extendable
                          ] ?? entity.extendsKey}
                        </Badge>
                      ) : (
                        <span className="text-ink-subtle">
                          {t("moduleBuilder.extendsNone")}
                        </span>
                      )}
                    </Td>
                    <Td align="center" numeric>
                      {entity._count.fields}
                    </Td>
                    <Td align="center" numeric>
                      {entity._count.records}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        {can(context, "moduleBuilder.create") ? (
          <Card className="h-fit">
            <CardHeader title={t("moduleBuilder.newEntity")} />
            <EntityForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}
