/**
 * Settling a collector's day.
 *
 * The receipts say what a route collected; only counting the cash says what
 * came back. This works out the difference between the two and what it means,
 * because "faltan 450 pesos" and "sobran 450 pesos" are different problems and
 * neither should be rounded away into "cuadra".
 */

import { roundToStep, type Cents, type MinorUnitStep } from "../money";

export type SettlementResult = "balanced" | "short" | "over";

export interface Settlement {
  expectedCents: Cents;
  deliveredCents: Cents;
  /** Delivered minus expected: negative is money that never arrived. */
  differenceCents: Cents;
  result: SettlementResult;
}

/**
 * Compares what was collected against what was handed over.
 *
 * Both amounts are rounded to what the currency can actually represent first,
 * so a currency without cents cannot produce a one centavo "difference" that
 * nobody can hand over.
 */
export function settle(
  expectedCents: Cents,
  deliveredCents: Cents,
  step: MinorUnitStep = 1,
): Settlement {
  const expected = roundToStep(expectedCents, step);
  const delivered = roundToStep(deliveredCents, step);
  const difference = delivered - expected;

  return {
    expectedCents: expected,
    deliveredCents: delivered,
    differenceCents: difference,
    result: difference === 0 ? "balanced" : difference < 0 ? "short" : "over",
  };
}

export interface CollectorRecord {
  settlements: number;
  balanced: number;
  short: number;
  over: number;
  /** Sum of every shortfall, as a positive number. */
  totalShortCents: Cents;
  totalOverCents: Cents;
  /** Net of the two, negative when the collector owes money overall. */
  netCents: Cents;
}

/**
 * A collector's track record across their settlements.
 *
 * Shortfalls and overages are kept apart on purpose: someone who is 500 short
 * one day and 500 over the next is not someone who "always cuadra", and
 * netting the two would hide exactly that.
 */
export function summarizeCollector(
  differences: readonly Cents[],
): CollectorRecord {
  let short = 0;
  let over = 0;
  let balanced = 0;
  let totalShortCents = 0;
  let totalOverCents = 0;

  for (const difference of differences) {
    if (difference === 0) balanced += 1;
    else if (difference < 0) {
      short += 1;
      totalShortCents += -difference;
    } else {
      over += 1;
      totalOverCents += difference;
    }
  }

  return {
    settlements: differences.length,
    balanced,
    short,
    over,
    totalShortCents,
    totalOverCents,
    netCents: totalOverCents - totalShortCents,
  };
}
