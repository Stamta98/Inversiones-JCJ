import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Icon,
  PageHeader,
  StatCard,
  type Tone,
} from "@/components/ui";
import {
  bucketOf,
  evaluatePromise,
  summarizePromises,
  type PromiseBucket,
  type PromiseStatus,
} from "@/core/collections/promise";
import { toCents } from "@/core/money";
import { startOfDay } from "@/core/dates";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { cancelPromiseAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<PromiseStatus, Tone> = {
  PENDING: "info",
  KEPT: "positive",
  BROKEN: "danger",
  CANCELLED: "neutral",
};

/** "1 días de atraso" reads like a bug, so the singular has its own wording. */
function describeDays(days: number, t: (key: string) => string): string {
  if (days === 0) return t("promises.dueTodayBadge");
  if (days === -1) return t("promises.dayLate");
  if (days === 1) return t("promises.dayLeft");
  return days < 0
    ? t("promises.daysLate").replace("{days}", String(Math.abs(days)))
    : t("promises.daysLeft").replace("{days}", String(days));
}

/** Digits only: a phone written "809-555-0100" is not a valid wa.me link. */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "");
}

export default async function PromisesPage() {
  const context = await requirePermission("collections.read");
  const today = startOfDay(new Date());

  const promises = await db.paymentPromise.findMany({
    where: { companyId: context.companyId },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          mobilePhone: true,
        },
      },
      loan: { select: { id: true, code: true } },
    },
    orderBy: [{ promisedFor: "asc" }, { amount: "desc" }],
    take: 200,
  });

  const { t, money } = context;
  const canEdit = can(context, "collections.update");

  const grouped = new Map<PromiseBucket, typeof promises>();
  for (const promise of promises) {
    const bucket = bucketOf(
      promise.status as PromiseStatus,
      promise.promisedFor,
      today,
    );
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), promise]);
  }

  const record = summarizePromises(
    promises.map((promise) => promise.status as PromiseStatus),
  );

  const owedIn = (bucket: PromiseBucket) =>
    (grouped.get(bucket) ?? []).reduce(
      (total, promise) =>
        total + Math.max(0, Number(promise.amount) - Number(promise.paidAmount)),
      0,
    );

  const sections: Array<{
    bucket: PromiseBucket;
    title: string;
    hint?: string;
    tone: Tone;
  }> = [
    {
      bucket: "overdue",
      title: t("promises.overdue"),
      hint: t("promises.overdueHint"),
      tone: "danger",
    },
    {
      bucket: "today",
      title: t("promises.dueToday"),
      hint: t("promises.dueTodayHint"),
      tone: "warning",
    },
    { bucket: "upcoming", title: t("promises.upcoming"), tone: "info" },
    { bucket: "closed", title: t("promises.closed"), tone: "neutral" },
  ];

  return (
    <>
      <PageHeader
        title={t("promises.title")}
        description={t("promises.subtitle")}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("promises.overdue")}
          value={money(owedIn("overdue"))}
          hint={`${(grouped.get("overdue") ?? []).length}`}
          icon="alert-triangle"
          tone="danger"
        />
        <StatCard
          label={t("promises.dueToday")}
          value={money(owedIn("today"))}
          hint={`${(grouped.get("today") ?? []).length}`}
          icon="clock"
          tone="warning"
        />
        <StatCard
          label={t("promises.record")}
          value={
            record.kept + record.broken === 0
              ? "—"
              : t("promises.reliability").replace(
                  "{percent}",
                  String(record.reliability),
                )
          }
          hint={t("promises.recordSummary")
            .replace("{kept}", String(record.kept))
            .replace("{settled}", String(record.kept + record.broken))}
          icon="check"
          tone="positive"
        />
      </div>

      {promises.length === 0 ? (
        <Card>
          <EmptyState
            icon="clock"
            title={t("promises.emptyTitle")}
            hint={t("promises.emptyHint")}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => {
            const rows = grouped.get(section.bucket) ?? [];
            if (rows.length === 0) return null;

            return (
              <Card key={section.bucket}>
                <CardHeader
                  title={section.title}
                  description={section.hint}
                  action={<Badge tone={section.tone}>{rows.length}</Badge>}
                />
                <div>
                  {rows.map((promise) => {
                    const phone =
                      promise.customer.mobilePhone ?? promise.customer.phone;
                    const remaining = Math.max(
                      0,
                      Number(promise.amount) - Number(promise.paidAmount),
                    );
                    // The badge says where the promise stands right now: the
                    // daily sweep only writes down what is already true, and
                    // until it runs a promise that lapsed last night would
                    // still be labelled pending.
                    const live = evaluatePromise({
                      promisedCents: toCents(Number(promise.amount)),
                      paidCents: toCents(Number(promise.paidAmount)),
                      promisedFor: promise.promisedFor,
                      today,
                    });
                    const status =
                      promise.status === "PENDING"
                        ? live.status
                        : (promise.status as PromiseStatus);
                    const days = live.daysLeft;

                    return (
                      <div
                        key={promise.id}
                        className="flex flex-wrap items-start gap-3 border-b border-border p-4 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link
                              href={`/customers/${promise.customer.id}`}
                              className="font-medium text-brand-strong hover:underline"
                            >
                              {promise.customer.firstName}{" "}
                              {promise.customer.lastName}
                            </Link>
                            {promise.loan ? (
                              <Link
                                href={`/loans/${promise.loan.id}`}
                                className="text-xs text-ink-subtle hover:underline"
                              >
                                {promise.loan.code}
                              </Link>
                            ) : null}
                            <Badge tone={STATUS_TONES[status]}>
                              {t(`promises.status.${status}`)}
                            </Badge>
                            <span className="text-xs text-ink-subtle">
                              {t(`promises.source.${promise.source}`)}
                            </span>
                          </div>

                          <p className="mt-0.5 text-xs text-ink-muted">
                            {t("promises.promisedFor")}{" "}
                            {formatDate(promise.promisedFor, context.locale)}
                            {status === "PENDING" || status === "BROKEN"
                              ? ` · ${describeDays(days, t)}`
                              : ""}
                          </p>

                          {promise.notes ? (
                            <p className="mt-1 text-xs text-ink-subtle">
                              {promise.notes}
                            </p>
                          ) : null}

                          {phone ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                              <a
                                href={`tel:${phone}`}
                                className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                              >
                                <Icon name="phone" size={12} />
                                {t("collections.call")}
                              </a>
                              <a
                                href={`https://wa.me/${digitsOf(phone)}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                              >
                                <Icon name="message-circle" size={12} />
                                {t("collections.whatsapp")}
                              </a>
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <p className="numeric text-sm font-semibold text-ink">
                            {money(remaining)}
                          </p>
                          {Number(promise.paidAmount) > 0 ? (
                            <p className="numeric text-xs text-positive">
                              {t("promises.paidSoFar")}:{" "}
                              {money(Number(promise.paidAmount))}
                            </p>
                          ) : null}
                          {canEdit && promise.status === "PENDING" ? (
                            <form action={cancelPromiseAction} className="mt-1">
                              <input
                                type="hidden"
                                name="promiseId"
                                value={promise.id}
                              />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                              >
                                {t("promises.cancel")}
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
