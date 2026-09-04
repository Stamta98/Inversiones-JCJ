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
} from "@/components/ui";
import {
  summarizePromises,
  type PromiseStatus,
} from "@/core/collections/promise";
import { ageOn } from "@/core/customers/identity";
import { startOfDay } from "@/core/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { LoanRow } from "@/components/loans/loan-row";

import { CustomerMenu } from "./customer-menu";

export const dynamic = "force-dynamic";

function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/**
 * Un dato, con el rótulo encima del valor.
 *
 * Van de a dos por renglón: con el rótulo a un lado y el valor al otro, cada
 * dato se comía una línea entera y la ficha no cabía en la pantalla. Los que
 * traen texto largo — una dirección, un punto de referencia — piden el
 * renglón completo.
 */
function DetailRow({
  label,
  value,
  href,
  wide = false,
}: {
  label: string;
  value: string;
  /** Con enlace el valor se toca: un teléfono se marca, no se transcribe. */
  href?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[0.6875rem] tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words text-ink">
        {href ? (
          <a
            href={href}
            className="font-medium text-brand-strong hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/** La rejilla de los datos: dos por renglón. */
function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>;
}

/** Un rótulo dentro de la ficha, para no dejar quince renglones seguidos. */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mt-4 mb-1 text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase first:mt-0">
      {children}
    </p>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { id } = await params;
  const now = new Date();

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
          // Lo que la tarjeta necesita para decir cuántas cuotas van y
          // cuánto hay que pedir hoy.
          installments: {
            select: {
              number: true,
              dueDate: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
            },
          },
          payments: {
            where: { status: "POSTED" },
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { paidAt: true },
          },
        },
      },
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

  // Quién lo registró y quién le cobra: dos preguntas de todos los días en
  // una oficina con varios cobradores, y ninguna se podía contestar desde la
  // ficha. La primera vive en la bitácora; la segunda, en la última visita
  // que se le hizo.
  const [createdEntry, lastStop] = await Promise.all([
    db.auditLog.findFirst({
      where: {
        companyId: context.companyId,
        entityType: "Customer",
        entityId: customer.id,
        action: "customer.created",
      },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { fullName: true } } },
    }),
    db.routeStop.findFirst({
      where: { customerId: customer.id, collectorId: { not: null } },
      // La visita más reciente: RouteStop no lleva fecha propia, la del día
      // es la de su ruta.
      orderBy: { route: { scheduledFor: "desc" } },
      select: { collector: { select: { fullName: true } } },
    }),
  ]);
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
  // Todo lo que se le ha entregado a este cliente. Un préstamo anulado nunca
  // salió de la caja, así que no cuenta como plata prestada.
  // Solo dígitos, que es lo que aceptan tel: y wa.me.
  const digits = (value: string | null) => value?.replace(/\D/g, "") || null;
  const mobileDigits = digits(customer.mobilePhone);
  const homeDigits = digits(customer.phone);
  const lentTotal = customer.loans
    .filter((loan) => loan.status !== "CANCELLED")
    .reduce((total, loan) => total + Number(loan.principal), 0);

  // Solo los que tienen algo: un atajo a un cuadro vacío es un viaje perdido.
  const jumps = [
    {
      anchor: "prestamos",
      label: t("customers.jumpLoans"),
      icon: "hand-coins" as const,
      tint: "bg-brand-soft text-brand-strong",
      has: customer.loans.length > 0,
    },
    {
      anchor: "abonos",
      label: t("customers.jumpPayments"),
      icon: "receipt" as const,
      tint: "bg-positive-soft text-positive",
      has: payments.length > 0,
    },
    {
      anchor: "adjuntos",
      label: t("customers.jumpDocuments"),
      icon: "image" as const,
      tint: "bg-warning-soft text-warning",
      has: idDocuments.length > 0,
    },
    {
      anchor: "gestiones",
      label: t("customers.jumpInteractions"),
      icon: "headset" as const,
      tint: "bg-surface-muted text-ink-muted",
      has: customer.interactions.length > 0,
    },
  ].filter((jump) => jump.has);

  return (
    <>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        // Todo lo que se hace con un cliente cabe detrás de los tres puntos,
        // como en el préstamo: en el teléfono el nombre se queda con su
        // ancho en vez de pelearlo con dos botones.
        avatar={
          customer.photoUrl ? (
            // Same-origin, authenticated route; next/image adds nothing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.photoUrl}
              alt=""
              className="size-12 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-subtle ring-1 ring-border">
              {`${customer.firstName[0] ?? ""}${customer.lastName[0] ?? ""}`.toUpperCase()}
            </span>
          )
        }
        action={
          <CustomerMenu
            customerId={customer.id}
            phone={mobileDigits ?? homeDigits}
            canCreateLoan={can(context, "loans.create")}
            canEdit={can(context, "customers.update")}
            canDelete={can(context, "customers.delete")}
            hasAttachments={idDocuments.length > 0}
          />
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

      {/* Atajos a lo que está más abajo. La ficha es larga y en el teléfono
          llegar a los abonos eran cuatro deslizadas; el que no tiene nada
          que mostrar no sale, para no mandar a un cuadro vacío. */}
      {jumps.length > 0 ? (
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
      ) : null}

      {/* Con cuántos préstamos ha pasado, cuántos tiene abiertos, cuánto se
          le ha entregado y cuánto debe: es la hoja de vida del cliente en
          cuatro números, y antes solo estaba el último. */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          compact
          label={t("customers.loansTotal")}
          value={String(customer.loans.length)}
          icon="hand-coins"
          tone="neutral"
        />
        <StatCard
          compact
          label={t("customers.loansOpen")}
          value={String(openLoans.length)}
          hint={openLoans.length === 0 ? t("customers.noOpenLoans") : undefined}
          icon="check"
          tone={openLoans.length > 0 ? "positive" : "neutral"}
        />
        <StatCard
          compact
          label={t("customers.lentTotal")}
          value={money(lentTotal)}
          hint={t("customers.lentTotalHint")}
          icon="wallet"
          tone="info"
        />
        <StatCard
          compact
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
          <CardBody>
            <SectionLabel>{t("customers.identitySection")}</SectionLabel>
            <DetailGrid>
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
                label={t("common.status")}
                value={t(`customers.status.${customer.status}`)}
              />
            </DetailGrid>

            <SectionLabel>{t("customers.contactSection")}</SectionLabel>
            <DetailGrid>
              {/* El número se marca desde aquí: parado en la puerta nadie lo
                  copia a mano para llamar. */}
              <DetailRow
                label={t("customers.mobilePhone")}
                value={customer.mobilePhone ?? "—"}
                href={mobileDigits ? `tel:+${mobileDigits}` : undefined}
              />
              <DetailRow
                label={t("customers.phone")}
                value={customer.phone ?? "—"}
                href={homeDigits ? `tel:+${homeDigits}` : undefined}
              />
              <DetailRow
                label={t("customers.email")}
                value={customer.email ?? "—"}
                href={customer.email ? `mailto:${customer.email}` : undefined}
                wide
              />
            </DetailGrid>

            {mobileDigits ? (
              <div className="mt-3 flex gap-2">
                <LinkButton
                  href={`tel:+${mobileDigits}`}
                  variant="secondary"
                  size="sm"
                  icon="phone"
                >
                  {t("customers.callCustomer")}
                </LinkButton>
                <LinkButton
                  href={`https://wa.me/${mobileDigits}`}
                  variant="secondary"
                  size="sm"
                  icon="message-circle"
                >
                  {t("customers.whatsappCustomer")}
                </LinkButton>
              </div>
            ) : null}

            <SectionLabel>{t("customers.homeSection")}</SectionLabel>
            <DetailGrid>
              <DetailRow
                label={t("customers.address")}
                value={customer.address ?? "—"}
                wide
              />
              <DetailRow
                label={t("customers.neighborhood")}
                value={customer.neighborhood ?? "—"}
              />
              <DetailRow
                label={t("customers.landmark")}
                value={customer.landmark ?? "—"}
                wide
              />
              <DetailRow
                label={t("customers.city")}
                value={customer.city ?? "—"}
              />
              <DetailRow
                label={context.stateLabel}
                value={customer.state ?? "—"}
              />
              {/* Whether to believe the next promise is the question a
                  collector actually has about this customer. */}
            </DetailGrid>

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

            {/* De dónde salió la ficha y quién le cobra: con dos cobradores
                en la calle son las primeras dos preguntas de la oficina. */}
            <SectionLabel>{t("customers.registrySection")}</SectionLabel>
            <DetailGrid>
              <DetailRow
                wide
                label={t("customers.customerSince")}
                value={formatDateTime(
                  customer.createdAt,
                  context.locale,
                  context.timezone,
                )}
              />
              <DetailRow
                label={t("customers.createdBy")}
                value={
                  createdEntry?.user?.fullName ?? t("customers.unknownUser")
                }
              />
              <DetailRow
                label={t("customers.collectorInCharge")}
                value={
                  lastStop?.collector?.fullName ?? t("customers.noCollector")
                }
              />
              {/* Si nadie la ha tocado desde que se creó, decirlo dos veces
                  con la misma fecha no aporta. */}
              {customer.updatedAt.getTime() !== customer.createdAt.getTime() ? (
                <DetailRow
                  wide
                  label={t("customers.updatedAtLabel")}
                  value={formatDateTime(
                    customer.updatedAt,
                    context.locale,
                    context.timezone,
                  )}
                />
              ) : null}
              {/* Si promete y cumple, o promete y no: lo que uno quiere saber
                  antes de creerle la próxima. */}
              <DetailRow
                wide
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
            </DetailGrid>
          </CardBody>

          <CardHeader title={t("customers.workSection")} />
          <CardBody>
            <DetailGrid>
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
                  wide
                />
              ) : null}
              <DetailRow
                label={t("customers.workNeighborhood")}
                value={customer.workNeighborhood ?? "—"}
              />
              <DetailRow
                label={t("customers.workAddress")}
                value={customer.workAddress ?? "—"}
                wide
              />
              <DetailRow
                label={t("customers.workLandmark")}
                value={customer.workLandmark ?? "—"}
                wide
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
              {/* Cuánto gana y hasta cuánto se le presta, uno al lado del
                  otro: es la cuenta que uno hace antes de decir que sí. */}
              <DetailRow
                label={t("customers.creditLimit")}
                value={
                  Number(customer.creditLimit) > 0
                    ? money(Number(customer.creditLimit))
                    : t("customers.creditLimitNone")
                }
              />
            </DetailGrid>

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

          {/* La nota se podía escribir desde que existe el formulario, pero
              no se veía en ninguna parte: quedaba guardada y perdida. */}
          {customer.notes ? (
            <>
              <CardHeader title={t("common.notes")} />
              <CardBody>
                <p className="text-sm whitespace-pre-line text-ink">
                  {customer.notes}
                </p>
              </CardBody>
            </>
          ) : null}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card id="prestamos">
            <CardHeader title={t("customers.loansTab")} />
            {customer.loans.length === 0 ? (
              <EmptyState
                icon="hand-coins"
                title={t("loans.emptyTitle")}
                hint={t("loans.emptyHint")}
              />
            ) : (
              // Las mismas tarjetas de la lista de préstamos. La tabla de
              // cuatro columnas se salía por la derecha del teléfono y el
              // saldo quedaba fuera de la pantalla; la tarjeta cabe y además
              // dice cuántas cuotas van, cuántas están atrasadas y cuánto
              // hay que pedirle hoy. El nombre no se repite: es su ficha.
              <CardBody className="space-y-2">
                {customer.loans.map((loan) => (
                  <LoanRow
                    key={loan.id}
                    loan={loan}
                    now={now}
                    t={t}
                    money={money}
                    locale={context.locale}
                  />
                ))}
              </CardBody>
            )}
          </Card>

          {/* El menú de arriba trae aquí: "Ver adjuntos" tiene que aterrizar
              en algún lado. */}
          <Card id="adjuntos">
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

          <Card id="abonos">
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

          <Card id="gestiones">
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
