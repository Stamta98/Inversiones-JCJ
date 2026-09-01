import { notFound } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { es } from "@/i18n/es";
import {
  formatFieldValue,
  toFieldOptions,
  type CustomFieldType,
} from "@/modules/builder/fields";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { deleteField } from "../actions";
import { FieldForm, RecordForm } from "../forms";

export const dynamic = "force-dynamic";

export default async function CustomEntityPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const context = await requirePermission("moduleBuilder.read");
  const { key } = await params;

  const entity = await db.customEntity.findFirst({
    where: { key, companyId: context.companyId },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      records: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!entity) notFound();

  const { t } = context;
  const canEdit = can(context, "moduleBuilder.update");
  const listFields = entity.fields.filter((field) => field.showInList);

  return (
    <>
      <PageHeader
        title={entity.pluralName}
        description={entity.description ?? entity.key}
        action={
          entity.extendsKey ? (
            <Badge tone="info">
              {es.moduleBuilder.extendable[
                entity.extendsKey as keyof typeof es.moduleBuilder.extendable
              ] ?? entity.extendsKey}
            </Badge>
          ) : null
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("moduleBuilder.fields")} />
          {entity.fields.length === 0 ? (
            <EmptyState icon="blocks" title={t("common.empty")} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("moduleBuilder.fieldLabel")}</Th>
                  <Th>{t("moduleBuilder.fieldType")}</Th>
                  <Th align="center">{t("moduleBuilder.isRequired")}</Th>
                  {canEdit ? <Th align="right">{t("common.actions")}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {entity.fields.map((field) => (
                  <tr key={field.id}>
                    <Td>
                      {field.label}
                      <span className="block text-xs text-ink-subtle">
                        {field.key}
                      </span>
                    </Td>
                    <Td>
                      {t(`moduleBuilder.fieldTypeLabel.${field.type}`)}
                    </Td>
                    <Td align="center">
                      {field.isRequired ? t("common.yes") : t("common.no")}
                    </Td>
                    {canEdit ? (
                      <Td align="right">
                        <form action={deleteField}>
                          <input
                            type="hidden"
                            name="fieldId"
                            value={field.id}
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            {t("common.remove")}
                          </Button>
                        </form>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          {canEdit ? <FieldForm entityId={entity.id} /> : null}
        </Card>

        {!entity.extendsKey && entity.fields.length > 0 && canEdit ? (
          <Card>
            <CardHeader title={t("moduleBuilder.newRecord")} />
            <RecordForm
              entityId={entity.id}
              fields={entity.fields.map((field) => ({
                key: field.key,
                label: field.label,
                type: field.type as CustomFieldType,
                isRequired: field.isRequired,
                helpText: field.helpText,
                options: toFieldOptions(field.options),
              }))}
            />
          </Card>
        ) : null}
      </div>

      {!entity.extendsKey ? (
        <Card className="mt-4">
          <CardHeader title={t("moduleBuilder.records")} />
          {entity.records.length === 0 ? (
            <EmptyState icon="blocks" title={t("common.empty")} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  {listFields.map((field) => (
                    <Th key={field.id}>{field.label}</Th>
                  ))}
                  <Th>{t("common.date")}</Th>
                </tr>
              </thead>
              <tbody>
                {entity.records.map((record) => {
                  const data = record.data as Record<string, unknown>;
                  return (
                    <tr key={record.id}>
                      {listFields.map((field) => (
                        <Td key={field.id}>
                          {formatFieldValue(
                            field.type as CustomFieldType,
                            data[field.key],
                            toFieldOptions(field.options),
                          )}
                        </Td>
                      ))}
                      <Td numeric>{formatDate(record.createdAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      ) : null}
    </>
  );
}
