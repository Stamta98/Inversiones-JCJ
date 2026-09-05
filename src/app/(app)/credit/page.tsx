import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  StatCard,
  type Tone,
} from "@/components/ui";
import { PhotoZoom } from "@/components/ui/photo-zoom";
import { NOTICE_DAYS_REQUIRED, type CreditSeverity } from "@/core/credit/report";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import {
  listLookupsFor,
  listOwnReports,
  lookupDocument,
  type CreditLookupResult,
} from "@/server/services/credit";

import { WithdrawReport } from "./withdraw-report";

export const dynamic = "force-dynamic";

/**
 * La central de riesgo.
 *
 * Se entra a preguntar por una cédula: es lo único que se puede preguntar. No
 * hay lista de reportados ni búsqueda por nombre, a propósito — quien no sabe
 * a quién busca, no encuentra a nadie.
 */

const SEVERITY_TONES: Record<CreditSeverity, Tone> = {
  LATE: "warning",
  DEFAULT: "danger",
  FRAUD: "danger",
};

export default async function CreditPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const context = await requirePermission("credit.read");
  const { doc } = await searchParams;
  const { t, money } = context;

  // Solo se consulta cuando alguien escribió algo: entrar a la pantalla no es
  // consultar a nadie, y no tiene por qué quedar registrado como si lo fuera.
  let result: CreditLookupResult | null = null;
  let error: string | null = null;
  if (doc && doc.trim().length > 0) {
    try {
      result = await lookupDocument({
        companyId: context.companyId,
        userId: context.userId,
        document: doc,
      });
    } catch {
      error = t("credit.errors.document");
    }
  }

  const [own, lookups] = await Promise.all([
    listOwnReports(context.companyId),
    // Quién ha preguntado por esta cédula: solo cuando se está mirando una.
    result ? listLookupsFor(result.documentNumber) : Promise.resolve([]),
  ]);

  const canWithdraw = can(context, "credit.update");

  return (
    <>
      <PageHeader
        title={t("credit.title")}
        description={t("credit.subtitle")}
      />

      {/* --- Consultar ------------------------------------------------ */}
      <Card className="mb-4">
        <CardHeader
          title={t("credit.lookupTitle")}
          description={t("credit.lookupHint")}
        />
        <CardBody>
          {/* Un formulario de los de toda la vida: la cédula queda en la
              dirección, así que la consulta se puede compartir y recargar. */}
          <form method="get" className="flex flex-wrap items-end gap-2">
            <span className="min-w-48 flex-1">
              <label
                htmlFor="doc"
                className="mb-1 block text-xs font-medium text-ink-muted"
              >
                {t("credit.document")}
              </label>
              <Input
                id="doc"
                name="doc"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={doc ?? ""}
                placeholder="1014256789"
                className="numeric"
              />
            </span>
            <Button type="submit" icon="search">
              {t("credit.lookupAction")}
            </Button>
          </form>
          {error ? (
            <p className="mt-2 text-sm text-danger">{error}</p>
          ) : null}
        </CardBody>
      </Card>

      {/* --- Lo que salió --------------------------------------------- */}
      {result ? (
        result.reports.length === 0 ? (
          <Card className="mb-4">
            <CardBody className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
                <Icon name="check" size={20} />
              </span>
              <span>
                <span className="numeric block text-sm font-bold text-ink">
                  {result.documentNumber}
                </span>
                <span className="block text-base font-semibold text-positive">
                  {t("credit.clean")}
                </span>
                {/* Sin reportes no quiere decir buena paga: quiere decir que
                    nadie lo ha reportado. Decirlo evita prestar de más. */}
                <span className="mt-1 block max-w-prose text-sm text-ink-muted">
                  {t("credit.cleanHint")}
                </span>
              </span>
            </CardBody>
          </Card>
        ) : (
          <div className="mb-4 space-y-3">
            {/* Quién es: la cara y los datos, que es lo que se vino a ver. */}
            <Card>
              <CardBody className="flex items-start gap-3">
                {result.person?.photoUrl ? (
                  <PhotoZoom
                    src={result.person.photoUrl}
                    alt=""
                    caption={`${result.person.firstName} ${result.person.lastName}`}
                    className="size-16 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
                    <Icon name="users" size={24} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-tight font-bold text-ink uppercase">
                    {result.person?.firstName} {result.person?.lastName}
                  </span>
                  <span className="numeric mt-0.5 block text-sm text-ink-muted">
                    {result.person?.documentNumber}
                    {result.person?.city ? ` · ${result.person.city}` : ""}
                  </span>
                  {result.person?.mobilePhone ? (
                    <a
                      href={`tel:+${result.person.mobilePhone}`}
                      className="numeric mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline"
                    >
                      <Icon name="phone" size={14} />+
                      {result.person.mobilePhone}
                    </a>
                  ) : null}
                </span>
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                compact
                label={t("credit.totalOwed")}
                value={money(result.totalOwed)}
                tone="danger"
              />
              <StatCard
                compact
                label={
                  result.reports.length === 1
                    ? t("credit.foundOne")
                    : t("credit.found").replace(
                        "{count}",
                        String(result.reports.length),
                      )
                }
                value={
                  result.companies === 1
                    ? t("credit.inCompaniesOne")
                    : t("credit.inCompanies").replace(
                        "{count}",
                        String(result.companies),
                      )
                }
                tone="warning"
              />
            </div>

            {result.reports.map((report) => (
              <Card key={report.id}>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={SEVERITY_TONES[report.severity]}>
                      {t(`credit.severityLabel.${report.severity}`)}
                    </Badge>
                    {/* De quién es el reporte: es a quién hay que llamar. */}
                    <Badge tone={report.isOwn ? "brand" : "neutral"}>
                      {report.isOwn
                        ? t("credit.yourCompany")
                        : report.companyName}
                    </Badge>
                    {report.loanCode ? (
                      <Badge tone="info">{report.loanCode}</Badge>
                    ) : null}
                  </div>

                  <p className="numeric text-2xl font-bold tracking-tight text-danger">
                    {money(report.amount)}
                  </p>

                  {report.reason ? (
                    <p className="max-w-prose text-sm text-ink">
                      {report.reason}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-2 text-xs">
                    {[
                      {
                        label: t("credit.reportedOn"),
                        value: formatDate(report.reportedAt),
                      },
                      {
                        label: t("credit.expiresOn"),
                        value: formatDate(report.expiresAt),
                      },
                      {
                        label: t("loans.daysInArrears"),
                        value: String(report.daysInArrears),
                      },
                      {
                        label: t("credit.noticedOn"),
                        value: report.noticedAt
                          ? formatDate(report.noticedAt)
                          : "—",
                      },
                    ].map((row) => (
                      <span key={row.label} className="min-w-0">
                        <span className="block text-ink-muted">
                          {row.label}
                        </span>
                        <span className="numeric block font-semibold text-ink">
                          {row.value}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Solo quien reportó puede retirar lo suyo. */}
                  {report.isOwn && canWithdraw ? (
                    <WithdrawReport
                      reportId={report.id}
                      name={`${result.person?.firstName} ${result.person?.lastName}`}
                    />
                  ) : null}
                </CardBody>
              </Card>
            ))}

            {/* Quién más ha preguntado por esta persona. */}
            <Card>
              <CardHeader
                title={t("credit.lookupsTitle")}
                description={t("credit.lookupsHint")}
              />
              <CardBody className="divide-y divide-border py-0">
                {lookups.length === 0 ? (
                  <p className="py-3 text-sm text-ink-muted">
                    {t("credit.lookupsEmpty")}
                  </p>
                ) : (
                  lookups.map((lookup) => (
                    <div
                      key={lookup.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {lookup.company.name}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {lookup.user?.fullName ?? ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="numeric block text-xs text-ink-muted">
                          {formatDate(lookup.createdAt)}
                        </span>
                        <span className="block text-[0.6875rem] text-ink-subtle">
                          {lookup.foundCount === 0
                            ? t("credit.lookupNothing")
                            : t("credit.lookupFound").replace(
                                "{count}",
                                String(lookup.foundCount),
                              )}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>
        )
      ) : null}

      {/* --- Lo que esta oficina ha reportado -------------------------- */}
      <Card>
        <CardHeader
          title={t("credit.ownTitle")}
          description={t("credit.reportHint")}
        />
        {own.length === 0 ? (
          <EmptyState
            icon="alert-triangle"
            title={t("credit.ownEmpty")}
            hint={t("credit.lookupHint")}
          />
        ) : (
          <CardBody className="divide-y divide-border py-0">
            {own.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <Link
                    href={`/credit?doc=${report.documentNumber}`}
                    className="block truncate text-sm font-semibold text-ink hover:underline"
                  >
                    {report.firstName} {report.lastName}
                  </Link>
                  <span className="numeric block truncate text-xs text-ink-muted">
                    {report.documentNumber}
                    {report.loan ? ` · ${report.loan.code}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="numeric text-sm font-bold text-ink">
                    {money(Number(report.amount))}
                  </span>
                  <Badge
                    tone={report.status === "ACTIVE" ? "danger" : "neutral"}
                  >
                    {t(`credit.statusLabel.${report.status}`)}
                  </Badge>
                </span>
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      {/* Lo que la ley pide antes de señalar a alguien, dicho donde se hace. */}
      <p className="mt-3 max-w-prose text-xs text-ink-subtle">
        {t("credit.noticedAtHint").replace(
          "{days}",
          String(NOTICE_DAYS_REQUIRED),
        )}
      </p>
    </>
  );
}
