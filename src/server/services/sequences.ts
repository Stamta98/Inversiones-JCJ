/**
 * Human readable sequential codes (CLI-000123, PRE-000045, REC-001045).
 *
 * Taken from the highest code already issued rather than from the row count:
 * counting looks equivalent until something is deleted, and then the next code
 * comes out repeating one that is already printed on a receipt in somebody's
 * hand. The unique constraint plus a retry covers two people creating at once.
 */

import type { Prisma } from "@prisma/client";

import { nextCode, type SequencePrefix } from "@/core/sequences";

export type { SequencePrefix };

export async function nextCustomerCode(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const latest = await tx.customer.findFirst({
    where: { companyId },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return nextCode("CLI", latest?.code);
}

export async function nextLoanCode(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const latest = await tx.loan.findFirst({
    where: { companyId },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return nextCode("PRE", latest?.code);
}

export async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const latest = await tx.payment.findFirst({
    where: { companyId },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  return nextCode("REC", latest?.receiptNumber);
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
