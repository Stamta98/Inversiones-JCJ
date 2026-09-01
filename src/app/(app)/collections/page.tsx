import Link from "next/link";

import {
  Badge,
  Card,
  Icon,
  CardHeader,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { RouteForm } from "./route-form";
import { StopStatusSelect } from "./stop-status-select";

export const dynamic = "force-dynamic";

const STOP_TONES: Record<string, Tone> = {
  PENDING: "neutral",
  VISITED: "info",
  COLLECTED: "positive",
  NOT_FOUND: "warning",
  PROMISED: "info",
  REFUSED: "danger",
};

export default async function CollectionsPage() {
  const context = await requirePermission("collections.read");

  const [routes, collectors] = await Promise.all([
    db.collectionRoute.findMany({
      where: { companyId: context.companyId, isActive: true },
      include: {
        stops: {
          include: {
            customer: true,
            loan: { select: { id: true, code: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { scheduledFor: "desc" },
      take: 10,
    }),
    db.membership.findMany({
      where: { companyId: context.companyId, isActive: true },
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  const { t, currencyCode } = context;
  const money = (value: number) => formatCurrency(value, currencyCode);
  const canEdit = can(context, "collections.update");

  return (
    <>
      <PageHeader
        title={t("collections.title")}
        description={t("modules.collections.description")}
      />

      {can(context, "collections.create") ? (
        <Card className="mb-4">
          <CardHeader title={t("collections.new")} />
          <RouteForm
            collectors={collectors.map((membership) => ({
              id: membership.user.id,
              label: membership.user.fullName,
            }))}
          />
        </Card>
      ) : null}

      {routes.length === 0 ? (
        <Card>
          <EmptyState
            icon="route"
            title={t("collections.emptyTitle")}
            hint={t("collections.emptyHint")}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => {
            const expected = route.stops.reduce(
              (sum, stop) => sum + Number(stop.expectedAmount),
              0,
            );
            const collected = route.stops.reduce(
              (sum, stop) => sum + Number(stop.collectedAmount),
              0,
            );

            return (
              <Card key={route.id}>
                <CardHeader
                  title={route.name}
                  description={
                    route.scheduledFor
                      ? `${formatDate(route.scheduledFor)} · ${route.stops.length} ${t("collections.stops").toLowerCase()}`
                      : undefined
                  }
                  action={
                    <span className="numeric text-sm text-ink-muted">
                      {money(collected)} / {money(expected)}
                    </span>
                  }
                />
                {route.stops.length === 0 ? (
                  <EmptyState icon="route" title={t("common.empty")} />
                ) : (
                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>{t("collections.order")}</Th>
                        <Th>{t("loans.customer")}</Th>
                        <Th>{t("customers.address")}</Th>
                        <Th align="right">{t("collections.expectedAmount")}</Th>
                        <Th align="center">{t("common.status")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {route.stops.map((stop) => (
                        <tr key={stop.id}>
                          <Td numeric>{stop.sortOrder + 1}</Td>
                          <Td>
                            {stop.loan ? (
                              <Link
                                href={`/loans/${stop.loan.id}`}
                                className="text-brand-strong hover:underline"
                              >
                                {stop.customer.firstName}{" "}
                                {stop.customer.lastName}
                              </Link>
                            ) : (
                              `${stop.customer.firstName} ${stop.customer.lastName}`
                            )}
                          </Td>
                          <Td className="max-w-xs">
                            <span className="line-clamp-1 text-ink-muted">
                              {stop.customer.neighborhood ??
                                stop.customer.address ??
                                "—"}
                            </span>
                            {/* The landmark is what gets a collector to the
                                door; the street address is the fallback. */}
                            {stop.customer.landmark ??
                            stop.customer.address ? (
                              <span className="line-clamp-1 text-xs text-ink-subtle">
                                {stop.customer.landmark ??
                                  stop.customer.address}
                              </span>
                            ) : null}
                            {stop.customer.latitude !== null &&
                            stop.customer.longitude !== null ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${stop.customer.latitude},${stop.customer.longitude}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-strong hover:underline"
                              >
                                <Icon name="map-pin" size={12} />
                                {t("customers.openInMaps")}
                              </a>
                            ) : null}
                          </Td>
                          <Td align="right" numeric>
                            {money(Number(stop.expectedAmount))}
                          </Td>
                          <Td align="center">
                            {canEdit ? (
                              <StopStatusSelect
                                stopId={stop.id}
                                status={stop.status}
                              />
                            ) : (
                              <Badge tone={STOP_TONES[stop.status] ?? "neutral"}>
                                {t(`collections.stopStatus.${stop.status}`)}
                              </Badge>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
