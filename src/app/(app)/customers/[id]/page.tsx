import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

const LOAN_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  ACTIVE: "positive",
  IN_ARREARS: "danger",
  PAID: "brand",
  CANCELLED: "neutral",
  WRITTEN_OFF: "warning",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, companyId: context.companyId },
    include: {
      loans: { orderBy: { createdAt: "desc" } },
      references: true,
      attachments: { orderBy: { createdAt: "asc" } },
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 10,
        include: { agent: { select: { fullName: true } } },
      },
    },
  });

  if (!customer) notFound();

  const { t, currencyCode } = context;
  const money = (value: number) => formatCurrency(value, currencyCode);
  const idDocuments = customer.attachments.filter(
    (attachment) =>
      attachment.kind === "ID_FRONT" || attachment.kind === "ID_BACK",
  );
  const worstArrears = customer.loans.reduce(
    (worst, loan) => Math.max(worst, loan.daysInArrears),
    0,
  );

  return (
    <>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        description={customer.code}
        action={
          can(context, "loans.create") ? (
            <LinkButton href={`/loans/new?customerId=${customer.id}`} icon="plus">
              {t("loans.new")}
            </LinkButton>
          ) : null
        }
      />

      <div className="space-y-3">
        {customer.status === "BLACKLISTED" ? (
          <Alert tone="danger">{t("customers.blacklistWarning")}</Alert>
        ) : null}
        {worstArrears > 0 ? (
          <Alert tone="warning">
            {t("customers.arrearsWarning", { days: worstArrears })}
          </Alert>
        ) : null}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title={t("customers.singular")} />
          <CardBody className="flex flex-col items-center pb-2">
            {customer.photoUrl ? (
              // Same-origin, authenticated route; next/image adds nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customer.photoUrl}
                alt={`${customer.firstName} ${customer.lastName}`}
                className="size-28 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex size-28 items-center justify-center rounded-full border border-dashed border-border bg-surface-muted text-xs text-ink-subtle">
                {t("customers.noPhoto")}
              </div>
            )}
          </CardBody>
          <CardBody className="pt-0">
            <dl>
              <DetailRow
                label={t("customers.documentNumber")}
                value={customer.documentNumber ?? "—"}
              />
              <DetailRow
                label={t("customers.mobilePhone")}
                value={customer.mobilePhone ?? "—"}
              />
              <DetailRow
                label={t("customers.phone")}
                value={customer.phone ?? "—"}
              />
              <DetailRow
                label={t("customers.email")}
                value={customer.email ?? "—"}
              />
              <DetailRow
                label={t("customers.address")}
                value={customer.address ?? "—"}
              />
              <DetailRow
                label={t("customers.neighborhood")}
                value={customer.neighborhood ?? "—"}
              />
              <DetailRow
                label={t("customers.city")}
                value={customer.city ?? "—"}
              />
              <DetailRow
                label={t("common.status")}
                value={t(`customers.status.${customer.status}`)}
              />
            </dl>
          </CardBody>

          <CardHeader title={t("customers.workSection")} />
          <CardBody>
            <dl>
              <DetailRow
                label={t("customers.employmentType")}
                value={
                  customer.employmentType
                    ? t(
                        `customers.employmentTypeLabel.${customer.employmentType}`,
                      )
                    : "—"
                }
              />
              <DetailRow
                label={t("customers.occupation")}
                value={customer.occupation ?? "—"}
              />
              {customer.employmentType === "EMPLOYEE" ? (
                <DetailRow
                  label={t("customers.employerName")}
                  value={customer.employerName ?? "—"}
                />
              ) : null}
              <DetailRow
                label={t("customers.workAddress")}
                value={customer.workAddress ?? "—"}
              />
              <DetailRow
                label={t("customers.workNeighborhood")}
                value={customer.workNeighborhood ?? "—"}
              />
              <DetailRow
                label={t("customers.monthlyIncome")}
                value={
                  customer.monthlyIncome
                    ? money(Number(customer.monthlyIncome))
                    : "—"
                }
              />
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title={t("customers.loansTab")} />
            {customer.loans.length === 0 ? (
              <EmptyState
                icon="hand-coins"
                title={t("loans.emptyTitle")}
                hint={t("loans.emptyHint")}
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>{t("loans.code")}</Th>
                    <Th align="right">{t("loans.principal")}</Th>
                    <Th align="right">{t("loans.outstanding")}</Th>
                    <Th align="center">{t("common.status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.loans.map((loan) => (
                    <tr key={loan.id}>
                      <Td numeric>
                        <Link
                          href={`/loans/${loan.id}`}
                          className="text-brand-strong hover:underline"
                        >
                          {loan.code}
                        </Link>
                      </Td>
                      <Td align="right" numeric>
                        {money(Number(loan.principal))}
                      </Td>
                      <Td align="right" numeric>
                        {money(Number(loan.outstanding))}
                      </Td>
                      <Td align="center">
                        <Badge tone={LOAN_TONES[loan.status] ?? "neutral"}>
                          {t(`loans.status.${loan.status}`)}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader
              title={t("customers.documentsSection")}
              description={t("customers.documentsHint")}
            />
            {idDocuments.length === 0 ? (
              <EmptyState icon="image" title={t("common.empty")} />
            ) : (
              <CardBody className="grid gap-4 sm:grid-cols-2">
                {idDocuments.map((document) => (
                  <figure key={document.id}>
                    <a href={document.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={document.url}
                        alt={document.name}
                        className="aspect-[16/10] w-full rounded-xl border border-border object-cover"
                      />
                    </a>
                    <figcaption className="mt-1.5 text-xs text-ink-muted">
                      {document.kind === "ID_FRONT"
                        ? t("customers.idFront")
                        : t("customers.idBack")}
                    </figcaption>
                  </figure>
                ))}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title={t("customers.interactionsTab")} />
            {customer.interactions.length === 0 ? (
              <EmptyState icon="headset" title={t("common.empty")} />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>{t("callCenter.occurredAt")}</Th>
                    <Th>{t("callCenter.channel")}</Th>
                    <Th>{t("callCenter.outcome")}</Th>
                    <Th>{t("callCenter.agent")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.interactions.map((interaction) => (
                    <tr key={interaction.id}>
                      <Td numeric>{formatDate(interaction.occurredAt)}</Td>
                      <Td>
                        {t(`callCenter.channelLabel.${interaction.channel}`)}
                      </Td>
                      <Td>
                        {t(`callCenter.outcomeLabel.${interaction.outcome}`)}
                      </Td>
                      <Td>{interaction.agent?.fullName ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
