import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { createExpenseCategory } from "./actions";
import { ExpenseForm } from "./expense-form";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const context = await requirePermission("expenses.read");

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [expenses, categories, cashBoxes, monthTotal] = await Promise.all([
    db.expense.findMany({
      where: { companyId: context.companyId },
      include: {
        category: { select: { name: true } },
        loan: { select: { code: true } },
      },
      orderBy: { spentAt: "desc" },
      take: 50,
    }),
    db.expenseCategory.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { name: "asc" },
    }),
    db.cashBox.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.expense.aggregate({
      where: { companyId: context.companyId, spentAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
  ]);

  const { t, currencyCode } = context;
  const money = (value: number) => formatCurrency(value, currencyCode);
  const canEdit = can(context, "expenses.create");

  return (
    <>
      <PageHeader
        title={t("expenses.title")}
        description={t("modules.expenses.description")}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard
          label={t("common.thisMonth")}
          value={money(Number(monthTotal._sum.amount ?? 0))}
          icon="trending-down"
          tone="warning"
        />
        <StatCard
          label={t("expenses.categories")}
          value={String(categories.length)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("expenses.title")} />
          {expenses.length === 0 ? (
            <EmptyState
              icon="trending-down"
              title={t("expenses.emptyTitle")}
              hint={t("expenses.emptyHint")}
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("expenses.spentAt")}</Th>
                  <Th>{t("expenses.description")}</Th>
                  <Th>{t("expenses.category")}</Th>
                  <Th>{t("expenses.linkedLoan")}</Th>
                  <Th align="right">{t("common.amount")}</Th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <Td numeric>{formatDate(expense.spentAt)}</Td>
                    <Td>{expense.description}</Td>
                    <Td>{expense.category?.name ?? "—"}</Td>
                    <Td numeric>{expense.loan?.code ?? "—"}</Td>
                    <Td align="right" numeric>
                      {money(Number(expense.amount))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          {canEdit ? (
            <ExpenseForm
              categories={categories.map((category) => ({
                id: category.id,
                label: category.name,
              }))}
              cashBoxes={cashBoxes.map((cashBox) => ({
                id: cashBox.id,
                label: cashBox.name,
              }))}
            />
          ) : null}
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("expenses.categories")} />
          <CardBody className="space-y-3">
            <ul className="space-y-1 text-sm text-ink-muted">
              {categories.length === 0 ? (
                <li>{t("common.empty")}</li>
              ) : (
                categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))
              )}
            </ul>

            {canEdit ? (
              <form action={createExpenseCategory} className="flex gap-2">
                <Input
                  name="name"
                  placeholder={t("expenses.newCategory")}
                  aria-label={t("expenses.newCategory")}
                />
                <Button type="submit" size="sm" icon="plus">
                  {t("common.add")}
                </Button>
              </form>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
