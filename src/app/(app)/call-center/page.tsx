import Link from "next/link";

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { InteractionForm } from "./interaction-form";

export const dynamic = "force-dynamic";

/** How many overdue customers the agent works through at a time. */
const QUEUE_SIZE = 20;

export default async function CallCenterPage() {
  const context = await requirePermission("callCenter.read");

  const [queue, recent, promisedCount] = await Promise.all([
    db.loan.findMany({
      where: { companyId: context.companyId, status: "IN_ARREARS" },
      include: { customer: true },
      orderBy: [{ daysInArrears: "desc" }, { outstanding: "desc" }],
      take: QUEUE_SIZE,
    }),
    db.interaction.findMany({
      where: { companyId: context.companyId },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        agent: { select: { fullName: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    db.interaction.count({
      where: {
        companyId: context.companyId,
        outcome: "PAYMENT_PROMISED",
        promisedFor: { gte: new Date() },
      },
    }),
  ]);

  const { t, currencyCode } = context;
  const money = (value: number) => formatCurrency(value, currencyCode);
  const canLog = can(context, "callCenter.create");

  return (
    <>
      <PageHeader
        title={t("callCenter.title")}
        description={t("modules.callCenter.description")}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard
          label={t("callCenter.queue")}
          value={String(queue.length)}
          icon="headset"
          tone="brand"
        />
        <StatCard
          label={t("callCenter.outcomeLabel.PAYMENT_PROMISED")}
          value={String(promisedCount)}
          icon="clock"
          tone="info"
        />
      </div>

      {queue.length === 0 ? (
        <Card>
          <EmptyState icon="check" title={t("callCenter.emptyQueue")} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {queue.map((loan) => {
            const phone =
              loan.customer.mobilePhone ?? loan.customer.phone ?? null;

            return (
              <Card key={loan.id}>
                <CardHeader
                  title={`${loan.customer.firstName} ${loan.customer.lastName}`}
                  description={`${loan.code} · ${money(Number(loan.outstanding))}`}
                  action={
                    <Badge
                      tone={loan.daysInArrears > 30 ? "danger" : "warning"}
                    >
                      {loan.daysInArrears} d
                    </Badge>
                  }
                />
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {phone ? (
                      <>
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-ink hover:bg-surface-muted"
                        >
                          <Icon name="phone" size={14} />
                          {t("callCenter.callNow")}
                        </a>
                        <a
                          href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-ink hover:bg-surface-muted"
                        >
                          <Icon name="message-circle" size={14} />
                          {t("callCenter.whatsappNow")}
                        </a>
                      </>
                    ) : null}
                    <Link
                      href={`/loans/${loan.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-ink hover:bg-surface-muted"
                    >
                      <Icon name="hand-coins" size={14} />
                      {t("loans.singular")}
                    </Link>
                  </div>

                  {canLog ? (
                    <InteractionForm
                      customerId={loan.customerId}
                      loanId={loan.id}
                    />
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader title={t("callCenter.interactions")} />
        {recent.length === 0 ? (
          <EmptyState icon="headset" title={t("common.empty")} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("callCenter.occurredAt")}</Th>
                <Th>{t("loans.customer")}</Th>
                <Th>{t("callCenter.channel")}</Th>
                <Th>{t("callCenter.outcome")}</Th>
                <Th>{t("callCenter.agent")}</Th>
                <Th>{t("common.notes")}</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((interaction) => (
                <tr key={interaction.id}>
                  <Td numeric>{formatDate(interaction.occurredAt)}</Td>
                  <Td>
                    {interaction.customer.firstName}{" "}
                    {interaction.customer.lastName}
                  </Td>
                  <Td>{t(`callCenter.channelLabel.${interaction.channel}`)}</Td>
                  <Td>
                    <Badge
                      tone={
                        interaction.outcome === "PAYMENT_MADE"
                          ? "positive"
                          : interaction.outcome === "REFUSED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {t(`callCenter.outcomeLabel.${interaction.outcome}`)}
                    </Badge>
                  </Td>
                  <Td>{interaction.agent?.fullName ?? "—"}</Td>
                  <Td className="max-w-xs">
                    <span className="line-clamp-1 text-ink-muted">
                      {interaction.notes ?? "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
