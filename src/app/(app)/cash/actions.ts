"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

const cashBoxSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["CASH", "BANK"]).default("CASH"),
  accountNumber: z.string().trim().optional(),
  openingBalance: z.coerce.number().min(0).default(0),
});

const movementSchema = z.object({
  cashBoxId: z.string().min(1),
  kind: z.enum(["DEPOSIT", "WITHDRAWAL", "ADJUSTMENT"]),
  amount: z.coerce.number().positive(),
  description: z.string().trim().optional(),
});

export interface CashFormState {
  error?: string;
}

export async function createCashBox(
  _previous: CashFormState,
  formData: FormData,
): Promise<CashFormState> {
  const context = await requirePermission("cash.create");
  const parsed = cashBoxSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;

  await db.$transaction(async (tx) => {
    const cashBox = await tx.cashBox.create({
      data: {
        companyId: context.companyId,
        branchId: context.branchId,
        name: data.name,
        kind: data.kind,
        accountNumber: data.accountNumber || null,
        balance: data.openingBalance,
      },
    });

    if (data.openingBalance > 0) {
      await tx.cashMovement.create({
        data: {
          cashBoxId: cashBox.id,
          kind: "DEPOSIT",
          amount: data.openingBalance,
          balanceAfter: data.openingBalance,
          description: "Saldo inicial",
          createdById: context.userId,
        },
      });
    }
  });

  revalidatePath("/cash");
  return {};
}

export async function createCashMovement(
  _previous: CashFormState,
  formData: FormData,
): Promise<CashFormState> {
  const context = await requirePermission("cash.create");
  const parsed = movementSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;
  // A withdrawal debits the box, everything else credits it.
  const signedAmount =
    data.kind === "WITHDRAWAL" ? -data.amount : data.amount;

  await db.$transaction(async (tx) => {
    const cashBox = await tx.cashBox.findFirstOrThrow({
      where: { id: data.cashBoxId, companyId: context.companyId },
      select: { balance: true },
    });

    const balanceAfter = Number(cashBox.balance) + signedAmount;

    await tx.cashBox.update({
      where: { id: data.cashBoxId },
      data: { balance: balanceAfter },
    });

    await tx.cashMovement.create({
      data: {
        cashBoxId: data.cashBoxId,
        kind: data.kind,
        amount: signedAmount,
        balanceAfter,
        description: data.description || null,
        createdById: context.userId,
      },
    });
  });

  revalidatePath("/cash");
  return {};
}
