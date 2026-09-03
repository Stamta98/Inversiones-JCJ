import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Select,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import { SortableRows } from "@/components/ui/sortable-rows";
import { isManuallyOrdered } from "@/core/ordering";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { LOAN_ORDER } from "@/server/services/ordering";

import { moveLoanAction, resetLoanOrderAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  ACTIVE: "positive",
  IN_ARREARS: "danger",
  PAID: "brand",
  CANCELLED: "neutral",
  WRITTEN_OFF: "warning",
};

const STATUSES = Object.keys(STATUS_TONES);

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const context = await requirePermission("loans.read");
  const { status } = await searchParams;

  const where: Prisma.LoanWhereInput = {
    companyId: context.companyId,
    ...(status && STATUSES.includes(status)
      ? { status: status as Prisma.EnumLoanStatusFilter["equals"] }
      : {}),
  };

  const loans = await db.loan.findMany({
    where,
    include: { customer: true },
    // Primero lo que la persona puso a mano, después el orden de siempre.
    orderBy: LOAN_ORDER,
    take: 50,
  });

  const { t, money } = context;
  const canOrder = can(context, "loans.update");
  const handOrdered = isManuallyOrdered(loans);

  return (
    <>
      <PageHeader
        title={t("loans.title")}
        action={
          can(context, "loans.create") ? (
            <LinkButton href="/loans/new" icon="plus">
              {t("loans.new")}
            </LinkButton>
          ) : null
        }
      />

      <form className="mb-4 max-w-xs" action="/loans">
        <Select
          name="status"
          defaultValue={status ?? ""}
          aria-label={t("common.status")}
        >
          <option value="">{t("common.all")}</option>
          {STATUSES.map((key) => (
            <option key={key} value={key}>
              {t(`loans.status.${key}`)}
            </option>
          ))}
        </Select>
        <noscript>
          <button type="submit" className="mt-2 text-sm underline">
            {t("common.filter")}
          </button>
        </noscript>
      </form>

      {canOrder ? (
        <form
          action={resetLoanOrderAction}
          className="mb-3 flex flex-wrap items-center gap-3"
        >
          <span className="text-xs text-ink-subtle">
            {handOrdered ? t("common.orderedByHand") : t("common.dragHint")}
          </span>
          {handOrdered ? (
            <Button type="submit" size="sm" variant="ghost" icon="refresh">
              {t("common.resetOrder")}
            </Button>
          ) : null}
        </form>
      ) : null}

      <Card>
        {loans.length === 0 ? (
          <EmptyState
            icon="hand-coins"
            title={t("loans.emptyTitle")}
            hint={t("loans.emptyHint")}
            action={
              can(context, "loans.create") ? (
                <LinkButton href="/loans/new" icon="plus" size="sm">
                  {t("loans.new")}
                </LinkButton>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("loans.code")}</Th>
                <Th>{t("loans.customer")}</Th>
                <Th>{t("loans.frequency")}</Th>
                <Th align="right">{t("loans.principal")}</Th>
                <Th align="right">{t("loans.outstanding")}</Th>
                <Th align="center">{t("loans.daysInArrears")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <SortableRows
              ids={loans.map((loan) => loan.id)}
              action={moveLoanAction}
              enabled={canOrder}
            >
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <Td numeric>
                    <Link
                      href={`/loans/${loan.id}`}
                      className="text-brand-strong hover:underline"
                    >
                      {loan.code}
                    </Link>
                    <span className="block text-xs text-ink-subtle">
                      {formatDate(loan.firstDueDate)}
                    </span>
                  </Td>
                  <Td>
                    {loan.customer.firstName} {loan.customer.lastName}
                  </Td>
                  <Td>{t(`loans.frequencyLabel.${loan.frequency}`)}</Td>
                  <Td align="right" numeric>
                    {money(Number(loan.principal))}
                  </Td>
                  <Td align="right" numeric>
                    {money(Number(loan.outstanding))}
                  </Td>
                  <Td align="center">
                    {loan.daysInArrears > 0 ? (
                      <Badge
                        tone={loan.daysInArrears > 30 ? "danger" : "warning"}
                      >
                        {loan.daysInArrears}
                      </Badge>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </Td>
                  <Td align="center">
                    <Badge tone={STATUS_TONES[loan.status] ?? "neutral"}>
                      {t(`loans.status.${loan.status}`)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </SortableRows>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
