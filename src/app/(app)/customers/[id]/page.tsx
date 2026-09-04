import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Badge,
  Icon,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import {
  summarizePromises,
  type PromiseStatus,
} from "@/core/collections/promise";
import { ageOn } from "@/core/customers/identity";
import { startOfDay } from "@/core/dates";
import { formatDate } from "@/lib/format";
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

function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

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
      loans: {
        orderBy: { createdAt: "desc" },
        include: {
          // Las cuotas que ya pasaron de fecha y siguen sin pagar: eso es lo
          // que está atrasado, contado hoy.
          _count: {
            select: {
              installments: {
                where: {
                  dueDate: { lt: startOfDay(new Date()) },
                  status: { notIn: ["PAID", "WAIVED"] },
                },
              },
            },
          },
        },
      },
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

  const payments = await db.payment.findMany({
    where: { companyId: context.companyId, loan: { customerId: customer.id } },
    include: { loan: { select: { id: true, code: true } } },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  const promises = await db.paymentPromise.findMany({
    where: { customerId: customer.id, companyId: context.companyId },
    select: { status: true },
  });
  const promiseRecord = summarizePromises(
    promises.map((promise) => promise.status as PromiseStatus),
  );

  const { t, money } = context;
  const idDocuments = customer.attachments.filter(
    (attachment) =>
      attachment.kind === "ID_FRONT" || attachment.kind === "ID_BACK",
  );
  // Lo que este cliente debe hoy, sumando solo los préstamos que siguen
  // abiertos: uno saldado ya no debe nada y uno anulado nunca se cobró.
  const openLoans = customer.loans.filter((loan) =>
    ["ACTIVE", "IN_ARREARS", "APPROVED"].includes(loan.status),
  );
  const overdueCount = openLoans.reduce(
    (total, loan) => total + loan._count.installments,
    0,
  );
  const outstanding = openLoans.reduce(
    (total, loan) => total + Number(loan.outstanding),
    0,
  );

  return (
    <>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        description={customer.code}
        action={
          <div className="flex flex-wrap gap-2">
            {can(context, "customers.update") ? (
              <LinkButton
                href={`/customers/${customer.id}/edit`}
                variant="secondary"
                icon="pencil"
              >
                {t("common.edit")}
              </LinkButton>
            ) : null}
            {can(context, "loans.create") ? (
              <LinkButton
                href={`/loans/new?customerId=${customer.id}`}
                icon="plus"
              >
                {t("loans.new")}
              </LinkButton>
            ) : null}
          </div>
        }
      />

      <div className="space-y-3">
        {customer.status === "BLACKLISTED" ? (
          <Alert tone="danger">{t("customers.blacklistWarning")}</Alert>
        ) : null}
        {overdueCount > 0 ? (
          <Alert tone="warning">
            {overdueCount === 1
              ? t("customers.arrearsWarningOne")
              : t("customers.arrearsWarning", { count: overdueCount })}
          </Alert>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("loans.outstanding")}
          value={money(outstanding)}
          hint={
            openLoans.length > 0
              ? `${openLoans.length} ${
                  openLoans.length === 1
                    ? t("loans.singular").toLowerCase()
                    : t("loans.title").toLowerCase()
                }`
              : t("customers.noOpenLoans")
          }
          icon="hand-coins"
          tone={overdueCount > 0 ? "danger" : "brand"}
        />
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
                label={t("customers.birthDate")}
                value={
                  customer.birthDate
                    ? `${formatDate(customer.birthDate, context.locale)} · ${t(
                        "customers.ageYears",
                      ).replace("{years}", String(ageOn(customer.birthDate)))}`
                    : "—"
                }
              />
              <DetailRow
                label={t("customers.gender")}
                value={
                  customer.gender
                    ? t(`customers.genderLabel.${customer.gender}`)
                    : "—"
                }
              />
              <DetailRow
                label={t("customers.nationality")}
                value={customer.nationality ?? "—"}
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
                label={t("customers.landmark")}
                value={customer.landmark ?? "—"}
              />
              <DetailRow
                label={t("customers.city")}
                value={customer.city ?? "—"}
              />
              <DetailRow
                label={context.stateLabel}
                value={customer.state ?? "—"}
              />
              <DetailRow
                label={t("common.status")}
                value={t(`customers.status.${customer.status}`)}
              />
              {/* Whether to believe the next promise is the question a
                  collector actually has about this customer. */}
              <DetailRow
                label={t("promises.record")}
                value={
                  promiseRecord.kept + promiseRecord.broken === 0
                    ? t("promises.recordNone")
                    : `${t("promises.recordSummary")
                        .replace("{kept}", String(promiseRecord.kept))
                        .replace(
                          "{settled}",
                          String(promiseRecord.kept + promiseRecord.broken),
                        )} · ${t("promises.reliability").replace(
                        "{percent}",
                        String(promiseRecord.reliability),
                      )}`
                }
              />
            </dl>

            {customer.latitude !== null && customer.longitude !== null ? (
              <a
                href={mapsUrl(customer.latitude, customer.longitude)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
              >
                <Icon name="map-pin" size={14} />
                {t("customers.openInMaps")}
              </a>
            ) : null}
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
                label={t("customers.workNeighborhood")}
                value={customer.workNeighborhood ?? "—"}
              />
              <DetailRow
                label={t("customers.workAddress")}
                value={customer.workAddress ?? "—"}
              />
              <DetailRow
                label={t("customers.workLandmark")}
                value={customer.workLandmark ?? "—"}
              />
              {/* Solo cuando la hay: la mayoría de clientes no trabaja con
                  vehículo y una fila con raya no dice nada. */}
              {customer.vehiclePlate ? (
                <DetailRow
                  label={t("customers.vehiclePlate")}
                  value={customer.vehiclePlate}
                />
              ) : null}
              <DetailRow
                label={t("customers.monthlyIncome")}
                value={
                  customer.monthlyIncome
                    ? money(Number(customer.monthlyIncome))
                    : "—"
                }
              />
            </dl>

            {customer.workLatitude !== null &&
            customer.workLongitude !== null ? (
              <a
                href={mapsUrl(customer.workLatitude, customer.workLongitude)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong hover:underline"
              >
                <Icon name="map-pin" size={14} />
                {t("customers.openInMaps")}
              </a>
            ) : null}
          </CardBody>

          <CardHeader title={t("customers.paydaySection")} />
          <CardBody>
            <dl>
              <DetailRow
                label={t("customers.paydayKind")}
                value={
                  customer.paydayKind
                    ? t(`customers.paydayKindLabel.${customer.paydayKind}`)
                    : "—"
                }
              />
              {customer.paydayWeekday !== null ? (
                <DetailRow
                  label={t("customers.paydayWeekday")}
                  value={t(`loans.weekday.${customer.paydayWeekday}`)}
                />
              ) : null}
              {customer.paydayDayOfMonth !== null ? (
                <DetailRow
                  label={t("customers.paydayDayOfMonth")}
                  value={String(customer.paydayDayOfMonth)}
                />
              ) : null}
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
              title={t("customers.referencesSection")}
              description={t("customers.referencesHint")}
            />
            {customer.references.length === 0 ? (
              <EmptyState icon="users" title={t("customers.noReferences")} />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>{t("customers.referenceName")}</Th>
                    <Th>{t("customers.referenceRelationship")}</Th>
                    <Th>{t("customers.referencePhone")}</Th>
                    <Th>{t("customers.referenceAddress")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.references.map((reference) => (
                    <tr key={reference.id}>
                      <Td>{reference.fullName}</Td>
                      <Td>{reference.relationship ?? "—"}</Td>
                      <Td numeric>
                        {reference.phone ? (
                          <a
                            href={`tel:${reference.phone}`}
                            className="text-brand-strong hover:underline"
                          >
                            {reference.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{reference.address ?? "—"}</Td>
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
            <CardHeader
              title={t("payments.history")}
              description={t("payments.historyHint")}
            />
            {payments.length === 0 ? (
              <EmptyState icon="receipt" title={t("payments.emptyTitle")} />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>{t("payments.receipt")}</Th>
                    <Th>{t("payments.paidAt")}</Th>
                    <Th>{t("loans.code")}</Th>
                    <Th align="right">{t("common.amount")}</Th>
                    <Th align="center">{t("common.status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <Td numeric>
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-brand-strong hover:underline"
                        >
                          {payment.receiptNumber}
                        </Link>
                      </Td>
                      <Td numeric>
                        {formatDate(payment.paidAt, context.locale)}
                      </Td>
                      <Td>
                        <Link
                          href={`/loans/${payment.loan.id}`}
                          className="text-ink-muted hover:underline"
                        >
                          {payment.loan.code}
                        </Link>
                      </Td>
                      <Td align="right" numeric>
                        {money(Number(payment.amount))}
                      </Td>
                      <Td align="center">
                        <Badge
                          tone={
                            payment.status === "REVERSED"
                              ? "danger"
                              : "positive"
                          }
                        >
                          {t(`payments.statusLabel.${payment.status}`)}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
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
