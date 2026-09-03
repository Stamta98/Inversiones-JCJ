/**
 * The numbers a payment receipt shows.
 *
 * A receipt is the only thing the customer keeps, and it is read standing in a
 * doorway: what was paid, how far along the loan is, and what is still owed.
 * Working those out here keeps them the same on screen, in the image that gets
 * sent over WhatsApp, and in anything printed later.
 */

import type { Cents } from "../money";

/**
 * Hides the middle of an identity document.
 *
 * The receipt travels through WhatsApp and ends up in a photo gallery, so it
 * carries enough for the customer to recognise their own document and not
 * enough for anyone else to use it.
 */
export function maskDocument(
  documentNumber: string | null | undefined,
): string {
  const digits = (documentNumber ?? "").trim();
  if (digits.length === 0) return "—";
  if (digits.length <= 4) return digits;

  return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
}

/**
 * How many installments the payments add up to, which is not the same as how
 * many installments were closed: paying half of one is real progress and the
 * customer counts it.
 */
export function installmentsCovered(
  paidCents: Cents,
  totalToPayCents: Cents,
  termCount: number,
): number {
  if (termCount <= 0 || totalToPayCents <= 0) return 0;

  const perInstallment = totalToPayCents / termCount;
  const covered = paidCents / perInstallment;
  // One decimal: "3,4 de 30" says more than "3" and does not pretend to a
  // precision nobody needs.
  return Math.round(Math.min(covered, termCount) * 10) / 10;
}

export interface ReceiptProgress {
  covered: number;
  termCount: number;
  outstandingCents: Cents;
  daysLate: number;
}

/** Whether the receipt should carry a late notice, and what it should say. */
export function isLate(progress: Pick<ReceiptProgress, "daysLate">): boolean {
  return progress.daysLate > 0;
}
