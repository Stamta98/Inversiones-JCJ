import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { requireAuth } from "@/server/auth/context";
import { signOut } from "@/server/auth/actions";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";

import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

/** The password the seed ships with, which is published in the README. */
const FACTORY_PASSWORD = "Cambiar123";

export default async function ProfilePage() {
  const context = await requireAuth();
  const { t } = context;

  const user = await db.user.findUniqueOrThrow({
    where: { id: context.userId },
    select: { passwordHash: true },
  });

  // Anyone who read the repository knows this one, so say so loudly.
  const usingFactoryPassword = await verifyPassword(
    FACTORY_PASSWORD,
    user.passwordHash,
  );

  return (
    <>
      <PageHeader title={t("profile.title")} description={context.fullName} />

      {usingFactoryPassword ? (
        <div className="mb-4">
          <Alert tone="danger">{t("profile.defaultPasswordWarning")}</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("profile.changePassword")}
            description={t("profile.changePasswordHint")}
          />
          <PasswordForm />
        </Card>

        <Card>
          <CardHeader title={t("nav.profile")} />
          <CardBody className="space-y-2 text-sm">
            <p className="font-medium text-ink">{context.fullName}</p>
            <p className="text-ink-muted">@{context.username}</p>
            <p className="text-ink-muted">{context.email}</p>
            <p className="text-ink-muted">{context.roleName}</p>
            <p className="text-ink-subtle">{context.companyName}</p>

            <form action={signOut} className="pt-2">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                icon="log-out"
                className="w-full"
              >
                {t("nav.signOut")}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
