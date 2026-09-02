import {
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { InstallAppCard } from "@/components/shell/install-app";
import { requireAuth } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  const { t } = await requireAuth();

  return (
    <>
      <PageHeader
        title={t("install.title")}
        description={t("install.hint")}
        action={
          <LinkButton href="/settings" variant="secondary" icon="arrow-left">
            {t("common.back")}
          </LinkButton>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("install.title")} />
          <InstallAppCard />
        </Card>

        <Card>
          <CardHeader title={t("install.apkTitle")} />
          <CardBody className="text-sm text-ink-muted">
            {t("install.apkHint")}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
