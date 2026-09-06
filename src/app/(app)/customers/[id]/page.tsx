import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Icon,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";
import {
  summarizePromises,
  type PromiseStatus,
} from "@/core/collections/promise";
import { ageOn } from "@/core/customers/identity";
import { startOfDay } from "@/core/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { customerDeletionSummary } from "@/server/services/customers";
import { db } from "@/server/db";
import { countActiveReports } from "@/server/services/credit";

import { PhotoZoom } from "@/components/ui/photo-zoom";

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
      // Solo los cuatro números de arriba: la lista de préstamos se fue a su
      // propia pantalla, y con ella la necesidad de traer aquí cada cuota de
      // cada préstamo de toda la vida del cliente.
      loans: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          principal: true,
          outstanding: true,
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
      // De los adjuntos y las gestiones aquí solo hace falta si hay o no
      // hay: es lo único que decide si el atajo de arriba aparece. Lo que
      // tienen dentro se lee en su propia pantalla.
      _count: { select: { attachments: true, interactions: true } },
    },
  });

  if (!customer) notFound();

  // Cuántos préstamos, cuánto debe y cuánto había pagado: es lo que el aviso
  // de borrar tiene que decir antes de llevárselo todo. Solo se pregunta a
  // quien puede borrar; a los demás no les hace falta.
  const deletion = can(context, "customers.delete")
    ? await customerDeletionSummary(context.companyId, customer.id)
    : null;

  const paymentCount = await db.payment.count({
    where: { companyId: context.companyId, loan: { customerId: customer.id } },
  });

  const promises = await db.paymentPromise.findMany({
    where: { customerId: customer.id, companyId: context.companyId },
    select: { status: true },
  });

  // Quién lo registró y quién le cobra: dos preguntas de todos los días en
  // una oficina con varios cobradores, y ninguna se podía contestar desde la
  // ficha. La primera vive en la bitácora; la segunda, en la última visita
  // que se le hizo.
  const [createdEntry, lastStop, reportedElsewhere] = await Promise.all([
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
    // ¿Está reportado en la central? Es lo primero que uno querría saber al
    // abrir la ficha de alguien a quien va a prestarle. No cuenta como
    // consulta: nadie preguntó, se abrió su ficha.
    countActiveReports(customer.documentNumber),
  ]);
  const promiseRecord = summarizePromises(
    promises.map((promise) => promise.status as PromiseStatus),
  );

  const { t, money } = context;
  // Lo que este cliente debe hoy, sumando solo los préstamos que siguen
  // abiertos: uno saldado ya no debe nada y uno incobrable ya no se cobra.
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
  // Solo dígitos, que es lo que aceptan tel: y wa.me.
  const digits = (value: string | null) => value?.replace(/\D/g, "") || null;
  const mobileDigits = digits(customer.mobilePhone);
  const homeDigits = digits(customer.phone);
  const lentTotal = customer.loans.reduce(
    (total, loan) => total + Number(loan.principal),
    0,
  );

  // Los atajos de arriba. Préstamos y documentos abren su propia pantalla:
  // el historial de alguien que lleva años puede ser largo, y las fotos de
  // la cédula pesan; metidos en la ficha había que pasarlos de largo cada
  // vez para llegar a lo demás. Los otros dos siguen bajando aquí mismo.
  //
  // Solo los que tienen algo: un atajo a un cuadro vacío es un viaje perdido.
  const jumps = [
    {
      key: "prestamos",
      href: `/customers/${customer.id}/loans`,
      label: t("customers.jumpLoans"),
      icon: "hand-coins" as const,
      tint: "bg-brand-soft text-brand-strong",
      has: customer.loans.length > 0,
    },
    {
      key: "abonos",
      href: `/customers/${customer.id}/payments`,
      label: t("customers.jumpPayments"),
      icon: "receipt" as const,
      tint: "bg-positive-soft text-positive",
      has: paymentCount > 0,
    },
    {
      key: "adjuntos",
      href: `/customers/${customer.id}/documents`,
      label: t("customers.jumpDocuments"),
      icon: "image" as const,
      tint: "bg-warning-soft text-warning",
      has: customer._count.attachments > 0,
    },
    {
      key: "gestiones",
      href: `/customers/${customer.id}/interactions`,
      label: t("customers.jumpInteractions"),
      icon: "headset" as const,
      tint: "bg-surface-muted text-ink-muted",
      has: customer._count.interactions > 0,
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
            // Del tamaño de una moneda no se le reconoce la cara: se toca y
            // se abre grande.
            <PhotoZoom
              src={customer.photoUrl}
              alt=""
              caption={`${customer.firstName} ${customer.lastName}`}
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
            deletion={
              deletion
                ? {
                    ...deletion,
                    money: {
                      outstanding: context.money(deletion.outstanding),
                      paid: context.money(deletion.paid),
                    },
                  }
                : undefined
            }
            hasAttachments={customer._count.attachments > 0}
            canReport={
              can(context, "credit.create") && Boolean(customer.documentNumber)
            }
          />
        }
      />

      <div className="space-y-3">
        {customer.status === "BLACKLISTED" ? (
          <Alert tone="danger">{t("customers.blacklistWarning")}</Alert>
        ) : null}
        {/* Oculto no es lo mismo que borrado: la ficha se abre igual y dice
            que no sale en la lista, con el botón para volver a mostrarlo. */}
        {customer.status === "INACTIVE" ? (
          <Alert tone="neutral" icon="clock">
            {t("customers.hidden")}
          </Alert>
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
      {/* Si está reportado, se dice arriba y en rojo: es lo que hay que saber
          antes de prestarle, no algo para descubrir bajando la ficha. */}
      {reportedElsewhere > 0 && can(context, "credit.read") ? (
        <Link
          href={`/credit?doc=${encodeURIComponent(customer.documentNumber ?? "")}`}
          className="mt-4 flex items-start gap-3 rounded-[--radius-card] border border-danger-soft bg-danger-soft/60 p-3 transition-shadow hover:shadow-md"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <Icon name="alert-triangle" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-danger">
              {t("credit.flagTitle")}
            </span>
            <span className="block text-sm text-ink">
              {reportedElsewhere === 1
                ? t("credit.flagOne")
                : t("credit.flagMany").replace(
                    "{count}",
                    String(reportedElsewhere),
                  )}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-danger">
              {t("credit.flagSee")}
              <Icon name="chevron-right" size={12} />
            </span>
          </span>
        </Link>
      ) : null}

      {jumps.length > 0 ? (
        <nav className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {jumps.map((jump) => (
            <a
              key={jump.key}
              href={jump.href}
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

      {/* Los datos del cliente, por temas y en tarjetas sueltas. Antes era
          una sola columna de un tercio con todo apilado dentro: en el
          escritorio quedaba un hilo de texto con media pantalla vacía al
          lado, y en el teléfono había que bajar mucho para llegar al final.
          Repartidos en la rejilla, cada tema se lee entero y el ancho se
          usa. En el teléfono la rejilla es de una columna y quedan uno
          debajo de otro, en el orden en que se preguntan. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader title={t("customers.identitySection")} />
          <CardBody>
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("customers.contactSection")} />
          <CardBody>
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("customers.homeSection")} />
          <CardBody>
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
          </CardBody>
        </Card>

        <Card>
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
        </Card>

        {/* De dónde salió la ficha y quién le cobra: con dos cobradores en
            la calle son las primeras dos preguntas de la oficina. */}
        <Card>
          <CardHeader title={t("customers.registrySection")} />
          <CardBody>
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
        </Card>

        {/* La nota se podía escribir desde que existe el formulario,
            pero no se veía en ninguna parte: quedaba guardada y perdida.
            Ya no se puede escribir una nueva, pero lo escrito se lee. */}
        {customer.notes ? (
          <Card>
            <CardHeader title={t("common.notes")} />
            <CardBody>
              <p className="text-sm whitespace-pre-line text-ink">
                {customer.notes}
              </p>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
