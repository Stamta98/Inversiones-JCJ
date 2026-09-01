"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

const expenseSchema = z.object({
  description: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  categoryId: z.string().optional(),
  cashBoxId: z.string().optional(),
  loanId: z.string().optional(),
  spentAt: z.string().optional(),
  reference: z.string().trim().optional(),
});

export interface ExpenseFormState {
  error?: string;
}

export async function createExpense(
  _previous: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const context = await requirePermission("expenses.create");
  const parsed = expenseSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;
  const spentAt = data.spentAt
    ? new Date(`${data.spentAt}T12:00:00.000Z`)
    : new Date();

  await db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        companyId: context.companyId,
        categoryId: data.categoryId || null,
        cashBoxId: data.cashBoxId || null,
        loanId: data.loanId || null,
        description: data.description,
        amount: data.amount,
        spentAt,
        reference: data.reference || null,
      },
    });

    // An expense paid from a box has to move the money out of it.
    if (data.cashBoxId) {
      const cashBox = await tx.cashBox.findFirstOrThrow({
        where: { id: data.cashBoxId, companyId: context.companyId },
        select: { balance: true },
      });
      const balanceAfter = Number(cashBox.balance) - data.amount;

      await tx.cashBox.update({
        where: { id: data.cashBoxId },
        data: { balance: balanceAfter },
      });
      await tx.cashMovement.create({
        data: {
          cashBoxId: data.cashBoxId,
          kind: "EXPENSE",
          amount: -data.amount,
          balanceAfter,
          description: data.description,
          expenseId: expense.id,
          createdById: context.userId,
        },
      });
    }
  });

  revalidatePath("/expenses");
  revalidatePath("/cash");
  return {};
}

export async function createExpenseCategory(
  formData: FormData,
): Promise<void> {
  const context = await requirePermission("expenses.create");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) return;

  await db.expenseCategory
    .create({ data: { companyId: context.companyId, name } })
    .catch(() => undefined);

  revalidatePath("/expenses");
}
