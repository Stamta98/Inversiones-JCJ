import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Badge,
  Card,
  EmptyState,
  Icon,
  Input,
  LinkButton,
  PageHeader,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import { SortableRows } from "@/components/ui/sortable-rows";
import { isManuallyOrdered } from "@/core/ordering";
import { initials } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { CUSTOMER_ORDER } from "@/server/services/ordering";

import { moveCustomerAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "positive",
  INACTIVE: "neutral",
  BLACKLISTED: "danger",
};

const PAGE_SIZE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  const where: Prisma.CustomerWhereInput = {
    companyId: context.companyId,
    ...(term
      ? {
          OR: [
            { firstName: { contains: term, mode: "insensitive" as const } },
            { lastName: { contains: term, mode: "insensitive" as const } },
            { code: { contains: term, mode: "insensitive" as const } },
            { documentNumber: { contains: term, mode: "insensitive" as const } },
            { mobilePhone: { contains: term } },
          ],
        }
      : {}),
  };

  const customers = await db.customer.findMany({
    where,
    // Primero lo que la persona puso a mano, después el orden de siempre.
    orderBy: CUSTOMER_ORDER,
    take: PAGE_SIZE,
    include: {
      // Los préstamos que tiene abiertos: cuántos son, y el peor atraso para
      // la marca roja junto al nombre.
      loans: {
        where: { status: { in: ["ACTIVE", "IN_ARREARS"] } },
        select: { daysInArrears: true },
      },
    },
  });

  const { t } = context;
  const canOrder = can(context, "customers.update");
  const handOrdered = isManuallyOrdered(customers);

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

      <form className="mb-4 flex gap-2" action="/customers">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-subtle"
          />
          <Input
            name="q"
            defaultValue={term}
            placeholder={t("common.searchPlaceholder")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>
      </form>

      {canOrder && !handOrdered ? (
        <p className="mb-3 text-xs text-ink-subtle">{t("common.dragHint")}</p>
      ) : null}

      <Card>
        {customers.length === 0 ? (
          <EmptyState
            icon="users"
            title={term ? t("common.empty") : t("customers.emptyTitle")}
            hint={term ? undefined : t("customers.emptyHint")}
            action={
              can(context, "customers.create") ? (
                <LinkButton href="/customers/new" icon="plus" size="sm">
                  {t("customers.new")}
                </LinkButton>
              ) : null
            }
          />
        ) : (
          <TableWrap roomy>
            <thead>
              <tr>
                <Th>{t("customers.fullName")}</Th>
                <Th>{t("customers.documentNumber")}</Th>
                <Th align="center">{t("customers.loanCount")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <SortableRows
              ids={customers.map((customer) => customer.id)}
              action={moveCustomerAction}
              enabled={canOrder}
            >
              {customers.map((customer) => {
                const worstArrears = customer.loans.reduce(
                  (worst, loan) => Math.max(worst, loan.daysInArrears),
                  0,
                );

                return (
                  // Lo lee SortableRows para saber qué fila se está moviendo.
                  <tr key={customer.id} data-sortable-id={customer.id}>
                    {/* El código ocupaba una columna entera para decir algo
                        que el nombre ya dice mejor. Buscar por código sigue
                        funcionando, y la ficha del cliente lo muestra. */}
                    <Td>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="flex items-center gap-2.5 text-ink hover:text-brand-strong"
                      >
                        {customer.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={customer.photoUrl}
                            alt=""
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[0.625rem] font-medium text-ink-subtle">
                            {initials(`${customer.firstName} ${customer.lastName}`)}
                          </span>
                        )}
                        <span className="min-w-0 font-medium">
                          {customer.firstName} {customer.lastName}
                          {worstArrears > 0 ? (
                            <Badge tone="danger" className="ml-2">
                              {worstArrears} d
                            </Badge>
                          ) : null}
                        </span>
                      </Link>
                    </Td>
                    <Td numeric>{customer.documentNumber ?? "—"}</Td>
                    <Td align="center">
                      {customer.loans.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-ink">
                          <Icon
                            name="hand-coins"
                            size={15}
                            className="text-ink-subtle"
                          />
                          <span className="numeric font-medium">
                            {customer.loans.length}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </Td>
                    <Td align="center">
                      <Badge tone={STATUS_TONES[customer.status] ?? "neutral"}>
                        {t(`customers.status.${customer.status}`)}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </SortableRows>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
