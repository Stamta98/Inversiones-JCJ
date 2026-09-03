/**
 * Refinancing and renewing a loan.
 *
 * Two things a street lender does constantly, and which the books get wrong if
 * they are recorded as an ordinary new loan:
 *
 * - **Refinancing.** The customer owes 200.000 of a 500.000 loan and cannot
 *   pay it. The 200.000 becomes the principal of a new loan and interest is
 *   charged on that. No money changes hands in either direction.
 *
 * - **Renewal.** The customer owes 100.000 and asks for 500.000 again. The
 *   100.000 is discounted from what they receive, so they walk away with
 *   400.000 and owe the full 500.000 plus interest.
 *
 * What both share: the old loan is settled by the new one rather than paid,
 * and the cash that moves is never the new principal. Getting that number
 * wrong means the cash box says one thing and the drawer says another.
 */

import { roundToStep, type Cents, type MinorUnitStep } from "../money";

export type RenewalKind = "REFINANCE" | "RENEWAL";

export const RENEWAL_KINDS: RenewalKind[] = ["REFINANCE", "RENEWAL"];

export interface RenewalInput {
  kind: RenewalKind;
  /** What the old loan still owes, late fees included. */
  outstandingCents: Cents;
  /** The new loan's principal. Ignored when refinancing: it is the balance. */
  newPrincipalCents?: Cents;
  step?: MinorUnitStep;
}

export interface RenewalPlan {
  kind: RenewalKind;
  /** Taken off the old loan and absorbed by the new one. */
  settledCents: Cents;
  newPrincipalCents: Cents;
  /** What the customer physically receives. Zero when refinancing. */
  cashOutCents: Cents;
}

export class RenewalError extends Error {
  constructor(
    message: string,
    readonly code: "noBalance" | "notNewMoney" | "principal",
  ) {
    super(message);
    this.name = "RenewalError";
  }
}

/**
 * Works out what a refinance or a renewal comes to.
 *
 * The balance is rounded to what the currency can hand over before anything
 * else, so a loan in pesos never leaves a principal ending in centavos that
 * nobody can collect.
 */
export function planRenewal(input: RenewalInput): RenewalPlan {
  const step = input.step ?? 1;
  const settledCents = roundToStep(input.outstandingCents, step);

  if (settledCents <= 0) {
    throw new RenewalError(
      "The loan has nothing left to carry over",
      "noBalance",
    );
  }

  if (input.kind === "REFINANCE") {
    // The balance is the loan. Asking for a different figure would mean either
    // handing over money (a renewal) or taking some in (a payment first).
    return {
      kind: "REFINANCE",
      settledCents,
      newPrincipalCents: settledCents,
      cashOutCents: 0,
    };
  }

  const newPrincipalCents = roundToStep(input.newPrincipalCents ?? 0, step);
  if (newPrincipalCents <= 0) {
    throw new RenewalError("The new loan needs an amount", "principal");
  }

  // Renewing for the balance or less hands the customer nothing, which is a
  // refinance wearing the wrong name — and below the balance it would quietly
  // forgive the difference.
  if (newPrincipalCents <= settledCents) {
    throw new RenewalError(
      "A renewal has to be larger than the outstanding balance",
      "notNewMoney",
    );
  }

  return {
    kind: "RENEWAL",
    settledCents,
    newPrincipalCents,
    cashOutCents: newPrincipalCents - settledCents,
  };
}
