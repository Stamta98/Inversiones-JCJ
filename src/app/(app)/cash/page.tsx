import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { CashBoxForm, MovementForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const context = await requirePermission("cash.read");

  const [cashBoxes, movements] = await Promise.all([
    db.cashBox.findMany({
      where: { companyId: context.companyId },
      orderBy: { name: "asc" },
    }),
    db.cashMovement.findMany({
      where: { cashBox: { companyId: context.companyId } },
      include: { cashBox: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const { t, money } = context;
  const canEdit = can(context, "cash.create");
  const total = cashBoxes.reduce(
    (sum, cashBox) => sum + Number(cashBox.balance),
    0,
  );

  return (
    <>
      <PageHeader
        title={t("cash.title")}
        description={t("modules.cash.description")}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard
          label={t("dashboard.cashOnHand")}
          value={money(total)}
          icon="wallet"
          tone="brand"
        />
        <StatCard label={t("cash.title")} value={String(cashBoxes.length)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("cash.title")} />
          {cashBoxes.length === 0 ? (
            <EmptyState
              icon="wallet"
              title={t("cash.emptyTitle")}
              hint={t("cash.emptyHint")}
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("cash.name")}</Th>
                  <Th>{t("cash.kind")}</Th>
                  <Th align="right">{t("cash.balance")}</Th>
                </tr>
              </thead>
              <tbody>
                {cashBoxes.map((cashBox) => (
                  <tr key={cashBox.id}>
                    <Td>
                      {cashBox.name}
                      {cashBox.accountNumber ? (
                        <span className="block text-xs text-ink-subtle">
                          {cashBox.accountNumber}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={cashBox.kind === "BANK" ? "info" : "neutral"}>
                        {t(`cash.kindLabel.${cashBox.kind}`)}
                      </Badge>
                    </Td>
                    <Td align="right" numeric>
                      {money(Number(cashBox.balance))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          {canEdit ? <CashBoxForm /> : null}
        </Card>

        {canEdit && cashBoxes.length > 0 ? (
          <Card>
            <CardHeader title={t("cash.movements")} />
            <MovementForm
              cashBoxes={cashBoxes.map((cashBox) => ({
                id: cashBox.id,
                label: cashBox.name,
              }))}
            />
          </Card>
        ) : null}
      </div>

      <Card className="mt-4">
        <CardHeader title={t("cash.movements")} />
        {movements.length === 0 ? (
          <EmptyState icon="wallet" title={t("common.empty")} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("common.date")}</Th>
                <Th>{t("cash.singular")}</Th>
                <Th>{t("common.details")}</Th>
                <Th align="right">{t("common.amount")}</Th>
                <Th align="right">{t("cash.balanceAfter")}</Th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <Td numeric>{formatDateTime(movement.createdAt)}</Td>
                  <Td>{movement.cashBox.name}</Td>
                  <Td>
                    {t(`cash.movementLabel.${movement.kind}`)}
                    {movement.description ? (
                      <span className="block text-xs text-ink-subtle">
                        {movement.description}
                      </span>
                    ) : null}
                  </Td>
                  <Td
                    align="right"
                    numeric
                    className={
                      Number(movement.amount) < 0 ? "text-danger" : "text-positive"
                    }
                  >
                    {money(Number(movement.amount))}
                  </Td>
                  <Td align="right" numeric>
                    {money(Number(movement.balanceAfter))}
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
