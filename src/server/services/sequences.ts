/**
 * Human readable sequential codes (CLI-000123, PRE-000045, REC-001045).
 *
 * Derived from the current row count inside a transaction, then retried on a
 * unique constraint violation, which keeps the codes gapless enough for an
 * operator without needing a separate counter table.
 */

import type { Prisma } from "@prisma/client";

export type SequencePrefix = "CLI" | "PRE" | "REC";

const PAD_LENGTH = 6;

function format(prefix: SequencePrefix, value: number): string {
  return `${prefix}-${String(value).padStart(PAD_LENGTH, "0")}`;
}

export async function nextCustomerCode(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const count = await tx.customer.count({ where: { companyId } });
  return format("CLI", count + 1);
}

export async function nextLoanCode(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const count = await tx.loan.count({ where: { companyId } });
  return format("PRE", count + 1);
}

export async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const count = await tx.payment.count({ where: { companyId } });
  return format("REC", count + 1);
}

/** Retries an operation whose only likely failure is a code collision. */
export async function withCodeRetry<T>(
  operation: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
      lastError = error;
    }
  }
  throw lastError;
}
