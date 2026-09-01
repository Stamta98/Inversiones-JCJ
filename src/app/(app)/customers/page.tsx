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
import { formatCurrency, initials } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

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
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: PAGE_SIZE,
    include: {
      loans: {
        where: { status: { in: ["ACTIVE", "IN_ARREARS"] } },
        select: { outstanding: true, daysInArrears: true },
      },
    },
  });

  const { t, currencyCode } = context;

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
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("customers.code")}</Th>
                <Th>{t("customers.fullName")}</Th>
                <Th>{t("customers.mobilePhone")}</Th>
                <Th align="right">{t("loans.outstanding")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const outstanding = customer.loans.reduce(
                  (total, loan) => total + Number(loan.outstanding),
                  0,
                );
                const worstArrears = customer.loans.reduce(
                  (worst, loan) => Math.max(worst, loan.daysInArrears),
                  0,
                );

                return (
                  <tr key={customer.id}>
                    <Td numeric>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-brand-strong hover:underline"
                      >
                        {customer.code}
                      </Link>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2.5">
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
                        <span className="min-w-0">
                          {customer.firstName} {customer.lastName}
                          {worstArrears > 0 ? (
                            <Badge tone="danger" className="ml-2">
                              {worstArrears} d
                            </Badge>
                          ) : null}
                        </span>
                      </span>
                    </Td>
                    <Td numeric>{customer.mobilePhone ?? "—"}</Td>
                    <Td align="right" numeric>
                      {formatCurrency(outstanding, currencyCode)}
                    </Td>
                    <Td align="center">
                      <Badge tone={STATUS_TONES[customer.status] ?? "neutral"}>
                        {t(`customers.status.${customer.status}`)}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
