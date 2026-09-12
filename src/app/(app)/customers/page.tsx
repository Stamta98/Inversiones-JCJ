import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Badge,
  Card,
  EmptyState,
  Icon,
  LinkButton,
  LiveSearch,
  PageHeader,
  type IconName,
  type Tone,
} from "@/components/ui";
import { SortableRows } from "@/components/ui/sortable-rows";
import { isManuallyOrdered } from "@/core/ordering";
import { initials } from "@/lib/format";
import { forSearch } from "@/lib/search";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { CUSTOMER_ORDER } from "@/server/services/ordering";

import { moveCustomerAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, Tone> = {
  INACTIVE: "neutral",
  BLACKLISTED: "danger",
};

/** Los préstamos que están afuera, que es lo que decide si se le presta más. */
const OPEN_STATUSES = ["ACTIVE", "IN_ARREARS", "APPROVED"] as const;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { ver } = await searchParams;
  // Los ocultos no salen, salvo que se pidan. Es el cliente que lleva meses
  // sin pedir nada: no se borra, se quita de en medio.
  const view = ver === "ocultos" || ver === "todos" ? ver : "visibles";

  const where: Prisma.CustomerWhereInput = {
    companyId: context.companyId,
    ...(view === "visibles"
      ? { status: { not: "INACTIVE" as const } }
      : view === "ocultos"
        ? { status: "INACTIVE" as const }
        : {}),
  };

  // Sin páginas. Con cincuenta por página el cobrador tenía que acordarse de
  // en cuál iba y darle a un número chiquito al final para seguir bajando; la
  // ruta del día es una sola lista y se baja con el pulgar de arriba a abajo.
  const [customers, total, withOpenLoans, withContact, hiddenTotal] =
    await Promise.all([
      db.customer.findMany({
        where,
        // Primero lo que la persona puso a mano, después el orden de siempre.
        orderBy: CUSTOMER_ORDER,
        include: {
          // Solo el estado: la lista dice cuántos préstamos abiertos tiene, y
          // el atraso se ve al abrir el cliente.
          loans: { select: { status: true } },
        },
      }),
      db.customer.count({ where }),
      db.customer.count({
        where: {
          ...where,
          loans: { some: { status: { in: [...OPEN_STATUSES] } } },
        },
      }),
      db.customer.count({
        where: {
          ...where,
          OR: [{ mobilePhone: { not: null } }, { phone: { not: null } }],
        },
      }),
      // Cuántos hay guardados: si no hay ninguno, el filtro sobra.
      db.customer.count({
        where: { companyId: context.companyId, status: "INACTIVE" },
      }),
    ]);

  const { t } = context;
  const canOrder = can(context, "customers.update");
  const handOrdered = isManuallyOrdered(customers);

  const stats: Array<{
    label: string;
    value: number;
    icon: IconName;
    tone: Tone;
  }> = [
    { label: t("customers.title"), value: total, icon: "users", tone: "info" },
    {
      label: t("customers.statActive"),
      value: withOpenLoans,
      icon: "check",
      tone: "positive",
    },
    {
      label: t("customers.statIdle"),
      value: total - withOpenLoans,
      icon: "clock",
      tone: "warning",
    },
    {
      label: t("customers.statContact"),
      value: withContact,
      icon: "phone",
      tone: "brand",
    },
  ];

  return (
    <>
      <PageHeader
        title={t("customers.title")}
        action={
          can(context, "customers.create") ? (
            <LinkButton href="/customers/new" icon="plus">
              {t("customers.new")}
            </LinkButton>
          ) : null
        }
      />

      <LiveSearch
        className="mb-3"
        placeholder={t("customers.searchPlaceholder")}
        label={t("common.search")}
        emptyLabel={t("common.searchEmpty")}
      />

      {/* El filtro solo aparece cuando hay alguno guardado: sin ocultos es un
          botón que no lleva a ninguna parte. */}
      {hiddenTotal > 0 ? (
        <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-xs text-ink-muted">
            {t("customers.showing")}
          </span>
          {[
            { key: "visibles", label: t("customers.onlyVisible") },
            { key: "ocultos", label: t("customers.onlyHidden") },
            { key: "todos", label: t("customers.allCustomers") },
          ].map((option) => {
            const params = new URLSearchParams();
            if (option.key !== "visibles") params.set("ver", option.key);
            const href = `/customers${params.size > 0 ? `?${params}` : ""}`;
            const active = option.key === view;

            return (
              <Link
                key={option.key}
                href={href}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-brand bg-brand-soft text-brand-strong"
                    : "border-border bg-surface text-ink-muted hover:bg-surface-muted"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
          <span className="numeric text-xs text-ink-subtle">
            {hiddenTotal === 1
              ? t("customers.hiddenCountOne")
              : t("customers.hiddenCount").replace(
                  "{count}",
                  String(hiddenTotal),
                )}
          </span>
        </nav>
      ) : null}

      {/* De un vistazo: cuántos son, a cuántos les está prestando y a cuántos
          podría llamar. Es lo que se mira antes de bajar por la lista. */}
      <Card className="mb-3">
        <div className="grid grid-cols-4 divide-x divide-border">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1.5 px-1 py-3"
            >
              <Badge tone={stat.tone} className="size-8 justify-center p-0">
                <Icon name={stat.icon} size={16} />
              </Badge>
              <span className="numeric text-lg font-semibold text-ink">
                {stat.value}
              </span>
              <span className="text-center text-[0.625rem] leading-tight font-medium tracking-wide text-ink-muted uppercase">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {canOrder && !handOrdered ? (
        <p className="mb-3 text-xs text-ink-subtle">{t("common.dragHint")}</p>
      ) : null}

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title={t("customers.emptyTitle")}
            hint={t("customers.emptyHint")}
            action={
              can(context, "customers.create") ? (
                <LinkButton href="/customers/new" icon="plus" size="sm">
                  {t("customers.new")}
                </LinkButton>
              ) : null
            }
          />
        </Card>
      ) : (
        <SortableRows
          as="div"
          className="space-y-2"
          ids={customers.map((customer) => customer.id)}
          action={moveCustomerAction}
          enabled={canOrder}
        >
          {customers.map((customer) => {
            const openLoans = customer.loans.filter((loan) =>
              (OPEN_STATUSES as readonly string[]).includes(loan.status),
            );
            const tone = STATUS_TONES[customer.status];

            return (
              <Card
                key={customer.id}
                sortableId={customer.id}
                className="overflow-hidden"
                searchText={forSearch(
                  customer.firstName,
                  customer.lastName,
                  customer.code,
                  customer.documentNumber,
                  customer.mobilePhone,
                  customer.phone,
                  customer.neighborhood,
                  customer.city,
                )}
              >
                <Link
                  href={`/customers/${customer.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-muted"
                >
                  {customer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={customer.photoUrl}
                      alt=""
                      className="size-11 shrink-0 rounded-full object-cover ring-2 ring-brand-soft"
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-subtle ring-2 ring-border">
                      {initials(`${customer.firstName} ${customer.lastName}`)}
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-ink uppercase">
                        {customer.firstName} {customer.lastName}
                      </span>
                      {tone ? (
                        <Badge tone={tone}>
                          {t(`customers.status.${customer.status}`)}
                        </Badge>
                      ) : null}
                    </span>
                    {/* El código de un cliente nuevo es su documento, así que
                        decirlo dos veces sobra. Los viejos llevan el
                        correlativo CLI-000003, y ese sí va aparte, con el
                        prefijo y los ceros quitados para que se lea. */}
                    {/* El iconito de la cédula va delante del número, en la
                        misma columna que el de ubicación del renglón de abajo,
                        para que los dos renglones se lean alineados. Es el
                        mismo icono que el cliente lleva en su ficha y en el
                        préstamo. */}
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                      {customer.code === customer.documentNumber ? (
                        <>
                          <Icon
                            name="credit-card"
                            size={12}
                            className="shrink-0 text-ink-subtle"
                          />
                          <span className="numeric font-semibold text-brand-strong">
                            {customer.documentNumber}
                          </span>
                        </>
                      ) : (
                        <>
                          {customer.documentNumber ? (
                            <Icon
                              name="credit-card"
                              size={12}
                              className="shrink-0 text-ink-subtle"
                            />
                          ) : null}
                          <span className="numeric font-semibold text-brand-strong">
                            #{customer.code.replace(/^CLI-0*/, "")}
                          </span>
                          {customer.documentNumber ? (
                            <span className="numeric">
                              {" · "}
                              {customer.documentNumber}
                            </span>
                          ) : null}
                        </>
                      )}
                    </span>
                    {/* El barrio, que es por donde el cobrador la ubica. */}
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-subtle">
                      <Icon name="map-pin" size={12} />
                      {customer.neighborhood ?? customer.city ?? "—"}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <Icon
                      name="hand-coins"
                      size={16}
                      className={
                        openLoans.length > 0
                          ? "text-positive"
                          : "text-ink-subtle"
                      }
                    />
                    <span
                      className={
                        "numeric text-sm font-semibold " +
                        (openLoans.length > 0
                          ? "text-positive"
                          : "text-ink-subtle")
                      }
                    >
                      {openLoans.length}/{customer.loans.length}
                    </span>
                    <Icon
                      name="chevron-right"
                      size={16}
                      className="text-ink-subtle"
                    />
                  </span>
                </Link>
              </Card>
            );
          })}
        </SortableRows>
      )}
    </>
  );
}
