import {
  Badge,
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import {
  EditUserForm,
  NewUserForm,
  ResetPasswordForm,
  type RoleOption,
} from "./user-forms";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const context = await requirePermission("users.read");

  const [memberships, roles] = await Promise.all([
    db.membership.findMany({
      where: { companyId: context.companyId },
      include: { user: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    db.role.findMany({
      where: { companyId: context.companyId },
      orderBy: { key: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const { t } = context;
  const canCreate = can(context, "users.create");
  const canUpdate = can(context, "users.update");
  const roleOptions: RoleOption[] = roles;

  return (
    <>
      <PageHeader
        title={t("settings.users")}
        description={t("modules.settings.description")}
        action={
          <LinkButton href="/settings" variant="secondary" icon="arrow-left">
            {t("common.back")}
          </LinkButton>
        }
      />

      {canCreate ? (
        <Card className="mb-4">
          <CardHeader title={t("settings.newUserTitle")} />
          <NewUserForm roles={roleOptions} />
        </Card>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {memberships.map((membership) => {
          const isSelf = membership.userId === context.userId;

          return (
            <Card key={membership.id}>
              <CardHeader
                title={membership.user.fullName}
                description={membership.user.email}
                action={
                  <Badge
                    tone={membership.user.isActive ? "positive" : "neutral"}
                  >
                    {membership.user.isActive
                      ? t("common.enabled")
                      : t("common.disabled")}
                  </Badge>
                }
              />

              {canUpdate ? (
                <>
                  <EditUserForm
                    user={{
                      id: membership.userId,
                      fullName: membership.user.fullName,
                      email: membership.user.email,
                      phone: membership.user.phone,
                      roleId: membership.roleId,
                      isActive: membership.user.isActive,
                    }}
                    roles={roleOptions}
                    // Deactivating yourself would lock you out immediately.
                    canDeactivate={!isSelf}
                  />
                  <CardHeader title={t("settings.resetPassword")} />
                  <ResetPasswordForm userId={membership.userId} />
                </>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
