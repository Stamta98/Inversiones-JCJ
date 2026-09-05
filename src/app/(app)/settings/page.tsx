import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Icon,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { MODULE_REGISTRY, type ModuleCategory } from "@/core/modules/registry";
import { flattenDictionary } from "@/i18n";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { saveLabels, toggleModule } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Configuración, por partes.
 *
 * Antes era un solo rollo de cinco pantallas de alto donde la empresa, los
 * módulos, la gente y los textos pesaban todos igual y había que bajar hasta
 * el final para saber qué había. Ahora cada cosa va en su sección, con su
 * nombre y su atajo arriba: se llega de un toque a la que se venía a buscar.
 */

/** El rótulo que abre cada parte, igual que en la ficha del cliente. */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mt-6 mb-2 text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase first:mt-0">
      {children}
    </p>
  );
}

/** El orden en que se ven los grupos de módulos, de lo básico a lo opcional. */
const MODULE_CATEGORIES: ModuleCategory[] = [
  "core",
  "operations",
  "communication",
  "customization",
];

/**
 * Los textos que se pueden cambiar, por temas.
 *
 * Antes salían los veinticuatro seguidos, ordenados por su nombre interno:
 * dos «Clientes» pegados —el del menú y el de la sección— sin manera de saber
 * cuál cambiaba qué. Agrupados, cada uno se entiende por dónde está.
 */
const LABEL_GROUPS = [
  { id: "business", keys: ["common.appName", "common.tagline"] },
  {
    id: "words",
    keys: [
      "loans.singular",
      "loans.title",
      "customers.singular",
      "customers.title",
      "payments.singular",
      "payments.title",
      "loans.installment",
      "loans.lateFee",
    ],
  },
  // Los del menú van en el mismo orden en que se ven en el menú, no en orden
  // alfabético: así se busca mirando, no leyendo.
  {
    id: "menu",
    keys: MODULE_REGISTRY.map((module) => module.labelKey),
  },
] as const;

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

  // Los atajos de arriba: a qué parte se quiere ir. Los textos solo aparecen
  // cuando se pueden cambiar, que si no es un viaje a mirar campos apagados.
  const jumps = [
    {
      anchor: "empresa",
      label: t("settings.companyTab"),
      icon: "building" as const,
      tint: "bg-brand-soft text-brand-strong",
      has: true,
    },
    {
      anchor: "modulos",
      label: t("settings.modulesTab"),
      icon: "blocks" as const,
      tint: "bg-info-soft text-info",
      has: true,
    },
    {
      anchor: "gente",
      label: t("settings.usersTab"),
      icon: "users" as const,
      tint: "bg-positive-soft text-positive",
      has: true,
    },
    {
      anchor: "textos",
      label: t("settings.labelsTab"),
      icon: "pencil" as const,
      tint: "bg-warning-soft text-warning",
      has: canEdit,
    },
  ].filter((jump) => jump.has);

  return (
    <>
      <PageHeader
        title={t("settings.title")}
        description={context.companyName}
      />

      <nav className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {jumps.map((jump) => (
          <a
            key={jump.anchor}
            href={`#${jump.anchor}`}
            className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-[0.6875rem] font-medium text-ink-muted transition-colors hover:bg-surface-muted"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-full ${jump.tint}`}
            >
              <Icon name={jump.icon} size={16} />
            </span>
            {jump.label}
          </a>
        ))}
      </nav>

      {/* --- La empresa ---------------------------------------------- */}
      <section id="empresa" className="scroll-mt-16">
        <SectionLabel>{t("settings.companyTab")}</SectionLabel>

        <Card>
          <CardHeader
            title={t("settings.companyTitle")}
            description={t("settings.companySectionHint")}
            action={
              canEdit ? (
                <LinkButton
                  href="/settings/company"
                  size="sm"
                  variant="secondary"
                  icon="settings"
                >
                  {t("common.edit")}
                </LinkButton>
              ) : null
            }
          />
          {/* Lo que hoy está puesto, sin tener que entrar a mirarlo. */}
          <CardBody className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: t("settings.currency"), value: context.currencyCode },
              { label: t("settings.timezone"), value: context.timezone },
              { label: t("settings.language"), value: context.locale },
              {
                label: t("settings.decimalsShort"),
                value: String(context.decimalPlaces),
              },
            ].map((row) => (
              <span key={row.label} className="min-w-0">
                <span className="block text-xs text-ink-muted">
                  {row.label}
                </span>
                <span className="numeric block truncate text-sm font-semibold text-ink">
                  {row.value}
                </span>
              </span>
            ))}
          </CardBody>
        </Card>

        <div className="mt-3">
          <Card>
            <CardHeader
              title={t("install.title")}
              description={t("install.hint")}
              action={
                <LinkButton
                  href="/install"
                  size="sm"
                  variant="secondary"
                  icon="plus"
                >
                  {t("install.action")}
                </LinkButton>
              }
            />
          </Card>
        </div>
      </section>

      {/* --- Los módulos ---------------------------------------------- */}
      <section id="modulos" className="scroll-mt-16">
        <SectionLabel>{t("settings.modulesTab")}</SectionLabel>

        <Card>
          <CardHeader
            title={t("settings.modulesTitle")}
            description={t("settings.modulesHint")}
          />
          <CardBody className="space-y-5">
            {MODULE_CATEGORIES.map((category) => {
              const modules = MODULE_REGISTRY.filter(
                (module) => module.category === category,
              );
              if (modules.length === 0) return null;

              return (
                <div key={category}>
                  <p className="text-sm font-semibold text-ink">
                    {t(`settings.moduleCategory.${category}`)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {t(`settings.moduleCategoryHint.${category}`)}
                  </p>

                  {/* Filas y no tabla: tres columnas en un teléfono dejaban
                      el estado cortado contra el borde. */}
                  <div className="mt-2 divide-y divide-border rounded-xl border border-border">
                    {modules.map((module) => {
                      const isEnabled =
                        enabledByKey.get(module.key) ?? !module.isRemovable;

                      return (
                        <div
                          key={module.key}
                          className="flex items-start justify-between gap-3 p-3"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <Icon
                                name={
                                  module.icon as Parameters<
                                    typeof Icon
                                  >[0]["name"]
                                }
                                size={15}
                                className="shrink-0 text-ink-subtle"
                              />
                              <span className="truncate text-sm font-medium text-ink">
                                {t(module.labelKey)}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs text-ink-muted">
                              {t(module.descriptionKey)}
                            </span>
                          </span>

                          <span className="shrink-0">
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
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </section>

      {/* --- Quién entra ---------------------------------------------- */}
      <section id="gente" className="scroll-mt-16">
        <SectionLabel>{t("settings.accessTitle")}</SectionLabel>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t("settings.users")}
              description={t("settings.accessHint")}
              action={
                can(context, "users.read") ? (
                  <LinkButton
                    href="/settings/users"
                    size="sm"
                    variant="secondary"
                  >
                    {t("common.edit")}
                  </LinkButton>
                ) : null
              }
            />
            <CardBody className="divide-y divide-border py-0">
              {users.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {membership.user.fullName}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {membership.user.email}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {/* Quien no puede entrar tiene que decirlo aquí: es la
                        primera pregunta cuando alguien reporta que no entra. */}
                    {membership.user.isActive ? null : (
                      <Badge tone="neutral">{t("common.disabled")}</Badge>
                    )}
                    <Badge tone="info">{membership.role.name}</Badge>
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("settings.roles")} />
            <CardBody className="divide-y divide-border py-0">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {role.name}
                    </span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {role.key}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="numeric block text-sm font-bold text-ink">
                      {role.permissions.includes("*")
                        ? t("common.all")
                        : role.permissions.length}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-muted">
                      {t("settings.permissions")}
                    </span>
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* --- Los textos ----------------------------------------------- */}
      {canEdit ? (
        <section id="textos" className="scroll-mt-16">
          <SectionLabel>{t("settings.labelsTab")}</SectionLabel>

          <Card>
            <CardHeader
              title={t("settings.labelsTitle")}
              description={t("settings.labelsHint")}
            />
            <form action={saveLabels}>
              <CardBody className="space-y-5">
                {LABEL_GROUPS.map((group) => (
                  <div key={group.id}>
                    <p className="text-sm font-semibold text-ink">
                      {t(`settings.labelGroup.${group.id}`)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t(`settings.labelGroupHint.${group.id}`)}
                    </p>

                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {group.keys.map((key) => {
                        const original = dictionary[key];
                        if (!original) return null;
                        const custom = context.translationOverrides[key] ?? "";

                        return (
                          <label key={key} className="block">
                            {/* Arriba el original y si está cambiado, para no
                                tener que adivinarlo mirando el campo. */}
                            <span className="mb-1 flex items-baseline justify-between gap-2">
                              <span className="truncate text-xs font-medium text-ink">
                                {original}
                              </span>
                              {custom ? (
                                <span className="shrink-0 text-[0.625rem] text-brand-strong">
                                  {t("settings.labelCustom")}
                                </span>
                              ) : null}
                            </span>
                            <Input
                              name={`label_${key}`}
                              defaultValue={custom}
                              placeholder={original}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end border-t border-border pt-3">
                  <Button type="submit" icon="check">
                    {t("common.save")}
                  </Button>
                </div>
              </CardBody>
            </form>
          </Card>
        </section>
      ) : null}
    </>
  );
}
