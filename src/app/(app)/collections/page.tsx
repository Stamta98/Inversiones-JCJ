import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Button,
} from "@/components/ui";
import { summarizeRoute, type StopStatus } from "@/core/collections/route";
import { startOfDay } from "@/core/dates";
import { toCents } from "@/core/money";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { RouteForm } from "./route-form";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; collector?: string; closed?: string }>;
}) {
  const context = await requirePermission("collections.read");
  const { day, collector, closed } = await searchParams;

  const dayFilter = day ? new Date(`${day}T00:00:00.000Z`) : null;
  const validDay =
    dayFilter && !Number.isNaN(dayFilter.getTime())
      ? startOfDay(dayFilter)
      : null;
  const showClosed = closed === "on";

  const where: Prisma.CollectionRouteWhereInput = {
    companyId: context.companyId,
    ...(showClosed ? {} : { closedAt: null }),
    ...(validDay
      ? {
          scheduledFor: {
            gte: validDay,
            lt: new Date(validDay.getTime() + 24 * 60 * 60 * 1000),
          },
        }
      : {}),
    ...(collector ? { stops: { some: { collectorId: collector } } } : {}),
  };

  const [routes, collectors] = await Promise.all([
    db.collectionRoute.findMany({
      where,
      include: {
        stops: {
          select: {
            status: true,
            expectedAmount: true,
            collectedAmount: true,
            collector: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    db.membership.findMany({
      where: { companyId: context.companyId, isActive: true },
      include: {
        user: { select: { id: true, fullName: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const { t, money } = context;

  const collectorOptions = collectors
    .filter((membership) => membership.user.isActive)
    .map((membership) => ({
      id: membership.user.id,
      label: membership.user.fullName,
    }));

  return (
    <>
      <PageHeader
        title={t("collections.title")}
        description={t("modules.collections.description")}
      />

      {can(context, "collections.create") ? (
        <Card className="mb-4">
          <CardHeader
            title={t("collections.new")}
            description={t("collections.emptyHint")}
          />
          <RouteForm collectors={collectorOptions} />
        </Card>
      ) : null}

      <Card className="mb-4">
        <form action="/collections">
          <CardBody className="grid items-end gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <label
                htmlFor="day"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("collections.filterDay")}
              </label>
              <Input id="day" name="day" type="date" defaultValue={day ?? ""} />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="collector"
                className="block text-xs font-medium text-ink-muted"
              >
                {t("collections.filterCollector")}
              </label>
              <Select
                id="collector"
                name="collector"
                defaultValue={collector ?? ""}
              >
                <option value="">{t("collections.allCollectors")}</option>
                {collectorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <label className="flex h-10 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="closed"
                defaultChecked={showClosed}
                className="size-4 rounded border-border"
              />
              {t("collections.showClosed")}
            </label>

            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="secondary" icon="search">
                {t("collections.apply")}
              </Button>
            </div>
          </CardBody>
        </form>
      </Card>

      {routes.length === 0 ? (
        <Card>
          <EmptyState
            icon="route"
            title={t("collections.emptyTitle")}
            hint={t("collections.emptyHint")}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {routes.map((route) => {
            const progress = summarizeRoute(
              route.stops.map((stop) => ({
                status: stop.status as StopStatus,
                expectedCents: toCents(Number(stop.expectedAmount)),
                collectedCents: toCents(Number(stop.collectedAmount)),
              })),
            );

            const assigned = [
              ...new Set(
                route.stops
                  .map((stop) => stop.collector?.fullName)
                  .filter((name): name is string => Boolean(name)),
              ),
            ];

            return (
              <Card key={route.id}>
                <CardHeader
                  title={route.name}
                  description={[
                    route.scheduledFor
                      ? formatDate(route.scheduledFor, context.locale)
                      : null,
                    assigned.length > 0
                      ? assigned.join(", ")
                      : t("collections.unassigned"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  action={
                    route.closedAt ? (
                      <Badge tone="neutral">
                        {t("collections.routeClosed")}
                      </Badge>
                    ) : (
                      <Badge tone="brand">{`${progress.percentVisited}%`}</Badge>
                    )
                  }
                />

                <CardBody className="space-y-3">
                  {/* The bar is the one thing a manager reads at a glance. */}
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                    role="progressbar"
                    aria-valuenow={progress.percentVisited}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("collections.progress")}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${progress.percentVisited}%` }}
                    />
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <dt className="text-ink-subtle">
                        {t("collections.stops")}
                      </dt>
                      <dd className="numeric font-medium text-ink">
                        {progress.visited}/{progress.total}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-subtle">
                        {t("collections.expectedAmount")}
                      </dt>
                      <dd className="numeric font-medium text-ink">
                        {money(progress.expectedCents / 100)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-subtle">
                        {t("collections.collectedAmount")}
                      </dt>
                      <dd className="numeric font-medium text-positive">
                        {money(progress.collectedCents / 100)}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/collections/${route.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline"
                  >
                    {t("collections.open")} →
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
