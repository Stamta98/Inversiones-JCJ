/**
 * Date helpers for repayment schedules.
 *
 * All schedule math is done on calendar days in UTC so that a schedule is
 * reproducible regardless of the server timezone.
 */

import type { PaymentFrequency } from "./types";

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Strips the time component, keeping the calendar day in UTC. */
export function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Adds months while clamping the day of month, so the 31st of January plus one
 * month lands on the 28th (or 29th) of February instead of rolling into March.
 */
export function addMonths(date: Date, months: number): Date {
  const dayOfMonth = date.getUTCDate();
  const result = new Date(date.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return result;
}

/** Whole days between two calendar days. Negative when `to` precedes `from`. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

/**
 * Advances a due date by `periods` payment periods.
 *
 * SEMIMONTHLY ("quincenal") alternates between the same day of the month and
 * that day plus fifteen, which is how twice-a-month collection actually works
 * on the street: you get paid on the 1st and the 16th, not every 14 days.
 */
export function advanceByFrequency(
  anchor: Date,
  frequency: PaymentFrequency,
  periods: number,
): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(anchor, periods);
    case "WEEKLY":
      return addDays(anchor, 7 * periods);
    case "BIWEEKLY":
      return addDays(anchor, 14 * periods);
    case "SEMIMONTHLY": {
      const wholeMonths = Math.floor(periods / 2);
      const hasHalfPeriod = periods % 2 === 1;
      const base = addMonths(anchor, wholeMonths);
      return hasHalfPeriod ? addDays(base, 15) : base;
    }
    case "MONTHLY":
      return addMonths(anchor, periods);
    case "QUARTERLY":
      return addMonths(anchor, 3 * periods);
    case "YEARLY":
      return addMonths(anchor, 12 * periods);
    case "SINGLE":
      return anchor;
    default: {
      const exhaustive: never = frequency;
      throw new Error(`Unsupported frequency: ${String(exhaustive)}`);
    }
  }
}

/** How many payment periods fit in a year. Used to annualize a rate. */
export function periodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "DAILY":
      return 365;
    case "WEEKLY":
      return 52;
    case "BIWEEKLY":
      return 26;
    case "SEMIMONTHLY":
      return 24;
    case "MONTHLY":
      return 12;
    case "QUARTERLY":
      return 4;
    case "YEARLY":
    case "SINGLE":
      return 1;
    default: {
      const exhaustive: never = frequency;
      throw new Error(`Unsupported frequency: ${String(exhaustive)}`);
    }
  }
}
