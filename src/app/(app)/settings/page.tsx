import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  LinkButton,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { MODULE_REGISTRY } from "@/core/modules/registry";
import { flattenDictionary } from "@/i18n";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { saveLabels, toggleModule } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Keys offered in the labels editor. The full dictionary has hundreds of
 * entries; these are the ones an operator actually wants to rename.
 */
const RENAMEABLE_PREFIXES = [
  "modules.",
  "loans.singular",
  "loans.title",
  "customers.singular",
  "customers.title",
  "payments.singular",
  "payments.title",
  "loans.installment",
  "loans.lateFee",
  "common.appName",
  "common.tagline",
];

export default async function SettingsPage() {
  const context = await requirePermission("settings.read");

  const [installations, users, roles] = await Promise.all([
    db.moduleInstallation.findMany({
      where: { companyId: context.companyId },
      select: { moduleKey: true, isEnabled: true },
    }),
    db.membership.findMany({
      where: { companyId: context.companyId },
      include: {
        user: { select: { fullName: true, email: true, isActive: true } },
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.role.findMany({
      where: { companyId: context.companyId },
      orderBy: { key: "asc" },
    }),
  ]);

  const { t } = context;
  const canEdit = can(context, "settings.update");
  const enabledByKey = new Map(
    installations.map((installation) => [
      installation.moduleKey,
      installation.isEnabled,
    ]),
  );

  const dictionary = flattenDictionary();
  const renameableKeys = Object.keys(dictionary)
    .filter((key) =>
      RENAMEABLE_PREFIXES.some((prefix) =>
        prefix.endsWith(".") ? key.startsWith(prefix) : key === prefix,
      ),
    )
    .filter((key) => !key.endsWith(".description"))
    .sort();

  return (
    <>
      <PageHeader
        title={t("settings.title")}
        description={context.companyName}
        action={
          can(context, "settings.update") ? (
            <LinkButton href="/settings/company" icon="settings">
              {t("settings.companyTitle")}
            </LinkButton>
          ) : null
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title={t("install.title")}
            description={t("install.hint")}
            action={
              <LinkButton href="/install" size="sm" variant="secondary" icon="plus">
                {t("install.action")}
              </LinkButton>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title={t("settings.modulesTitle")}
            description={t("settings.modulesHint")}
          />
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("settings.modulesTab")}</Th>
                <Th>{t("common.details")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {MODULE_REGISTRY.map((module) => {
                const isEnabled =
                  enabledByKey.get(module.key) ?? !module.isRemovable;

                return (
                  <tr key={module.key}>
                    <Td>{t(module.labelKey)}</Td>
                    <Td className="max-w-md">
                      <span className="text-ink-muted">
                        {t(module.descriptionKey)}
                      </span>
                    </Td>
                    <Td align="center">
                      {!module.isRemovable ? (
                        <Badge tone="brand">
                          {t("settings.moduleRequired")}
                        </Badge>
                      ) : canEdit ? (
                        <form action={toggleModule}>
                          <input
                            type="hidden"
                            name="moduleKey"
                            value={module.key}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={isEnabled ? "secondary" : "primary"}
                          >
                            {isEnabled
                              ? t("common.disable")
                              : t("common.enable")}
                          </Button>
                        </form>
                      ) : (
                        <Badge tone={isEnabled ? "positive" : "neutral"}>
                          {isEnabled
                            ? t("common.enabled")
                            : t("common.disabled")}
                        </Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t("settings.users")}
              action={
                can(context, "users.read") ? (
                  <LinkButton href="/settings/users" size="sm" variant="secondary">
                    {t("common.edit")}
                  </LinkButton>
                ) : null
              }
            />
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("customers.fullName")}</Th>
                  <Th>{t("auth.email")}</Th>
                  <Th>{t("settings.role")}</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((membership) => (
                  <tr key={membership.id}>
                    <Td>{membership.user.fullName}</Td>
                    <Td>{membership.user.email}</Td>
                    <Td>
                      <Badge tone="info">{membership.role.name}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader title={t("settings.roles")} />
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("settings.role")}</Th>
                  <Th align="center">{t("settings.permissions")}</Th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <Td>
                      {role.name}
                      <span className="block text-xs text-ink-subtle">
                        {role.key}
                      </span>
                    </Td>
                    <Td align="center" numeric>
                      {role.permissions.includes("*")
                        ? t("common.all")
                        : role.permissions.length}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </div>

        <Card>
          <CardHeader
            title={t("settings.labelsTitle")}
            description={t("settings.labelsHint")}
          />
          {canEdit ? (
            <form action={saveLabels}>
              <CardBody className="space-y-3">
                <Alert tone="info" icon="pencil">
                  {t("settings.labelsHint")}
                </Alert>
                <div className="grid gap-3 sm:grid-cols-2">
                  {renameableKeys.map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-xs text-ink-muted">
                        {dictionary[key]}
                      </span>
                      <Input
                        name={`label_${key}`}
                        defaultValue={
                          context.translationOverrides[key] ?? ""
                        }
                        placeholder={dictionary[key]}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="submit">{t("common.save")}</Button>
                </div>
              </CardBody>
            </form>
          ) : (
            <CardBody>
              <p className="text-sm text-ink-muted">
                {t("permissions.denied")}
              </p>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
