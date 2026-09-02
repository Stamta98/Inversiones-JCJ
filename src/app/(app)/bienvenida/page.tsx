import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Icon,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { findCurrency } from "@/core/locales/currencies";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { CompanyForm } from "../settings/company/company-form";
import { finishOnboarding } from "./actions";
import { CashBoxStep } from "./steps";

export const dynamic = "force-dynamic";

const TOTAL_STEPS = 3;

/** The trail of steps, so it is obvious how much is left. */
function Progress({ current }: { current: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div
            key={step}
            className={
              "h-1.5 flex-1 rounded-full " +
              (done || active ? "bg-brand" : "bg-border")
            }
          />
        );
      })}
    </div>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ paso?: string }>;
}) {
  const context = await requirePermission("settings.update");
  const { paso } = await searchParams;
  const step = Math.min(Math.max(Number(paso) || 1, 1), TOTAL_STEPS);
  const { t } = context;

  const company = await db.company.findUniqueOrThrow({
    where: { id: context.companyId },
    select: {
      name: true,
      legalName: true,
      taxId: true,
      email: true,
      phone: true,
      address: true,
      country: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      logoUrl: true,
      currencyCode: true,
      decimalPlaces: true,
      locale: true,
      timezone: true,
    },
  });

  const cashBox = await db.cashBox.findFirst({
    where: { companyId: context.companyId },
    select: { name: true },
  });

  const symbol = findCurrency(company.currencyCode)?.symbol ?? "$";

  return (
    <>
      <PageHeader
        title={t("onboarding.title", { company: company.name })}
        description={t("onboarding.subtitle")}
      />

      <div className="max-w-4xl">
        <Progress current={step} />
        <p className="mb-4 text-xs text-ink-muted">
          {t("onboarding.stepOf", { current: step, total: TOTAL_STEPS })}
        </p>

        {step === 1 ? (
          <>
            <Card className="mb-4">
              <CardHeader
                title={t("onboarding.companyStep")}
                description={t("onboarding.companyStepHint")}
              />
            </Card>
            {/* El mismo formulario de Configuración, para que no haya dos
                sitios distintos donde se editan los datos de la empresa. */}
            <CompanyForm company={company} nextHref="/bienvenida?paso=2" />
          </>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader
              title={t("onboarding.cashStep")}
              description={t("onboarding.cashStepHint")}
            />
            <CashBoxStep
              defaultName={cashBox?.name ?? "Caja principal"}
              currencySymbol={symbol}
              decimalPlaces={company.decimalPlaces}
            />
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <CardHeader
              title={t("onboarding.readyStep")}
              description={t("onboarding.readyHint")}
            />
            <CardBody className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-muted p-4">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  {t("onboarding.createdFor")}
                </p>
                <ul className="space-y-1.5 text-sm text-ink">
                  {[
                    t("onboarding.createdRoles"),
                    t("onboarding.createdTemplates"),
                    t("onboarding.createdAutomations"),
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-0.5 text-positive">
                        <Icon name="check" size={14} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <form action={finishOnboarding}>
                  <Button type="submit" variant="secondary">
                    {t("onboarding.skip")}
                  </Button>
                </form>
                <LinkButton href="/customers/new" icon="plus">
                  {t("onboarding.firstCustomer")}
                </LinkButton>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {step < TOTAL_STEPS ? (
          <form action={finishOnboarding} className="mt-4 text-center">
            <button
              type="submit"
              className="text-xs text-ink-subtle hover:underline"
            >
              {t("onboarding.skip")}
            </button>
          </form>
        ) : null}
      </div>
    </>
  );
}
