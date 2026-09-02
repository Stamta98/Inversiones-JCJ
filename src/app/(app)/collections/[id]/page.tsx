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
  StatCard,
} from "@/components/ui";
import { summarizeRoute, type StopStatus } from "@/core/collections/route";
import { expectedCashFor } from "@/server/services/collections";
import { toCents } from "@/core/money";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { AddStopForm, AssignRouteForm, RouteLifecycle } from "./route-tools";
import { SettlementForm } from "./settlement-form";
import { StopCard, type StopView } from "./stop-card";

export const dynamic = "force-dynamic";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("collections.read");
  const { id } = await params;

  const route = await db.collectionRoute.findFirst({
    where: { id, companyId: context.companyId },
    include: {
      stops: {
        include: {
          customer: true,
          loan: { select: { id: true, code: true } },
          payment: { select: { receiptNumber: true, status: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      settlement: {
        include: {
          collector: { select: { fullName: true } },
          settledBy: { select: { fullName: true } },
        },
      },
    },
  });

  if (!route) notFound();

  const { t, money } = context;
  const closed = route.closedAt !== null;
  const settlement = route.settlement;
  const canSettle = can(context, "cash.update") && settlement === null;
  const expectedCash = canSettle
    ? await expectedCashFor(context.companyId, route.id)
    : 0;
  const canEdit = can(context, "collections.update") && !closed;
  const canCollect = can(context, "payments.create") && !closed;

  const progress = summarizeRoute(
    route.stops.map((stop) => ({
      status: stop.status as StopStatus,
      expectedCents: toCents(Number(stop.expectedAmount)),
      collectedCents: toCents(Number(stop.collectedAmount)),
    })),
  );

  const [collectors, cashBoxes] = await Promise.all([
    db.membership.findMany({
      where: { companyId: context.companyId, isActive: true },
      include: {
        user: { select: { id: true, fullName: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.cashBox.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  // Collecting hides the box picker on a closed route; settling still needs it.
  const cashBoxesForSettlement = cashBoxes;

  // Loans not already on this route, offered for a stop added by hand.
  const routedLoanIds = route.stops
    .map((stop) => stop.loanId)
    .filter((loanId): loanId is string => loanId !== null);

  const addableLoans = canEdit
    ? await db.loan.findMany({
        where: {
          companyId: context.companyId,
          status: { in: ["ACTIVE", "IN_ARREARS"] },
          ...(routedLoanIds.length > 0 ? { id: { notIn: routedLoanIds } } : {}),
        },
        include: { customer: { select: { firstName: true, lastName: true } } },
        orderBy: { code: "asc" },
        take: 200,
      })
    : [];

  // Every stop carries the same collector unless somebody moved one, so the
  // first one is what the assignment control should show.
  const currentCollectorId = route.stops[0]?.collectorId ?? "";

  const stopViews: StopView[] = route.stops.map((stop, index) => ({
    id: stop.id,
    position: index + 1,
    customerName: `${stop.customer.firstName} ${stop.customer.lastName}`,
    customerCode: stop.customer.code,
    loanId: stop.loanId,
    loanCode: stop.loan?.code ?? null,
    phone: stop.customer.mobilePhone ?? stop.customer.phone,
    address: stop.customer.neighborhood ?? stop.customer.address,
    landmark: stop.customer.landmark,
    latitude: stop.customer.latitude,
    longitude: stop.customer.longitude,
    status: stop.status as StopStatus,
    expectedAmount: Number(stop.expectedAmount),
    collectedAmount: Number(stop.collectedAmount),
    promisedFor: stop.promisedFor
      ? stop.promisedFor.toISOString().slice(0, 10)
      : null,
    notes: stop.notes,
    // A reversed receipt is no longer proof of anything.
    receiptNumber:
      stop.payment && stop.payment.status !== "REVERSED"
        ? stop.payment.receiptNumber
        : null,
    canMoveUp: index > 0,
    canMoveDown: index < route.stops.length - 1,
  }));

  return (
    <>
      <PageHeader
        title={route.name}
        description={
          route.scheduledFor
            ? `${formatDate(route.scheduledFor, context.locale)} · ${route.stops.length} ${t("collections.stops").toLowerCase()}`
            : `${route.stops.length} ${t("collections.stops").toLowerCase()}`
        }
        action={
          <LinkButton href="/collections" variant="secondary" icon="arrow-left">
            {t("common.back")}
          </LinkButton>
        }
      />

      {closed ? (
        <div className="mb-4">
          <Alert tone="warning">{t("collections.closedNotice")}</Alert>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("collections.progress")}
          value={`${progress.visited}/${progress.total}`}
          hint={`${progress.percentVisited}% · ${progress.pending} ${t("collections.pending").toLowerCase()}`}
          icon="route"
        />
        <StatCard
          label={t("collections.expectedAmount")}
          value={money(progress.expectedCents / 100)}
          icon="hand-coins"
        />
        <StatCard
          label={t("collections.collectedAmount")}
          value={money(progress.collectedCents / 100)}
          hint={`${progress.percentCollected}% · ${progress.collectedStops} ${t("collections.stops").toLowerCase()}`}
          icon="receipt"
          tone="positive"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("collections.stops")} />
          {route.stops.length === 0 ? (
            <EmptyState icon="route" title={t("common.empty")} />
          ) : (
            <div>
              {stopViews.map((stop) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  cashBoxes={cashBoxes.map((cashBox) => ({
                    id: cashBox.id,
                    label: cashBox.name,
                  }))}
                  currencyCode={context.currencyCode}
                  locale={context.locale}
                  decimalPlaces={context.decimalPlaces}
                  canCollect={canCollect}
                  canEdit={canEdit}
                  editable={!closed}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {can(context, "collections.update") ? (
            <Card>
              <CardHeader title={t("collections.collector")} />
              {closed ? (
                <EmptyState icon="users" title={t("collections.routeClosed")} />
              ) : (
                <AssignRouteForm
                  routeId={route.id}
                  currentCollectorId={currentCollectorId}
                  collectors={collectors
                    .filter((membership) => membership.user.isActive)
                    .map((membership) => ({
                      id: membership.user.id,
                      label: membership.user.fullName,
                    }))}
                />
              )}
            </Card>
          ) : null}

          {canEdit ? (
            <Card>
              <CardHeader title={t("collections.addStop")} />
              <AddStopForm
                routeId={route.id}
                loans={addableLoans.map((loan) => ({
                  id: loan.id,
                  label: `${loan.code} — ${loan.customer.firstName} ${loan.customer.lastName}`,
                }))}
              />
            </Card>
          ) : null}

          {canSettle ? (
            <Card>
              <CardHeader
                title={t("collections.settlement")}
                description={t("collections.settlementHint")}
              />
              <SettlementForm
                routeId={route.id}
                expectedAmount={expectedCash}
                cashBoxes={cashBoxesForSettlement.map((cashBox) => ({
                  id: cashBox.id,
                  label: cashBox.name,
                }))}
                currencyCode={context.currencyCode}
                locale={context.locale}
                decimalPlaces={context.decimalPlaces}
              />
            </Card>
          ) : null}

          {settlement ? (
            <Card>
              <CardHeader
                title={t("collections.settlement")}
                description={t("collections.settledOn").replace(
                  "{date}",
                  formatDate(settlement.settledAt, context.locale),
                )}
                action={
                  <Badge
                    tone={
                      Number(settlement.differenceAmount) === 0
                        ? "positive"
                        : Number(settlement.differenceAmount) < 0
                          ? "danger"
                          : "warning"
                    }
                  >
                    {Number(settlement.differenceAmount) === 0
                      ? t("collections.balancedLabel")
                      : Number(settlement.differenceAmount) < 0
                        ? t("collections.shortLabel")
                        : t("collections.overLabel")}
                  </Badge>
                }
              />
              <CardBody className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">
                    {t("collections.expectedCash")}
                  </span>
                  <span className="numeric text-ink">
                    {money(Number(settlement.expectedAmount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">
                    {t("collections.delivered")}
                  </span>
                  <span className="numeric text-ink">
                    {money(Number(settlement.deliveredAmount))}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <span className="text-ink">{t("collections.difference")}</span>
                  <span
                    className={
                      Number(settlement.differenceAmount) < 0
                        ? "numeric text-danger"
                        : "numeric text-ink"
                    }
                  >
                    {money(Number(settlement.differenceAmount))}
                  </span>
                </div>
                {settlement.notes ? (
                  <p className="pt-1 text-ink-muted">{settlement.notes}</p>
                ) : null}
                {settlement.settledBy ? (
                  <p className="text-xs text-ink-subtle">
                    {t("collections.settledBy")}: {settlement.settledBy.fullName}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {can(context, "collections.update") ? (
            <Card>
              <CardHeader title={t("common.actions")} />
              <RouteLifecycle
                routeId={route.id}
                closed={closed}
                canDelete={can(context, "collections.delete")}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
