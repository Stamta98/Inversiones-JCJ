/**
 * Payday reasoning.
 *
 * Knowing when the customer actually has money in hand is the cheapest way to
 * lower arrears: a first installment set for the day after payday gets paid,
 * one set for three days later competes with the groceries.
 */

import { addDays, addMonths, nextCollectionDay, startOfDay } from "../dates";

export type PaydayKind =
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMIMONTHLY"
  | "MONTHLY"
  | "IRREGULAR";

export const PAYDAY_KINDS: PaydayKind[] = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "SEMIMONTHLY",
  "MONTHLY",
  "IRREGULAR",
];

export interface Payday {
  kind: PaydayKind | null;
  /** 0 = Sunday through 6 = Saturday, for WEEKLY and BIWEEKLY. */
  weekday?: number | null;
  /** 1-31, for MONTHLY. Values past the end of a month clamp to the last day. */
  dayOfMonth?: number | null;
}

/** Kinds that need a weekday to be usable. */
export function needsWeekday(kind: PaydayKind | null): boolean {
  return kind === "WEEKLY" || kind === "BIWEEKLY";
}

/** Kinds that need a day of the month to be usable. */
export function needsDayOfMonth(kind: PaydayKind | null): boolean {
  return kind === "MONTHLY";
}

function lastDayOfMonth(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

/** Moves a date to the given day of the month, clamped to the month's length. */
function onDayOfMonth(reference: Date, dayOfMonth: number): Date {
  const result = new Date(reference.getTime());
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth(reference)));
  return result;
}

/** The first payday strictly after `from`. Null when there is no pattern. */
export function nextPayday(payday: Payday, from: Date): Date | null {
  const today = startOfDay(from);

  switch (payday.kind) {
    case "DAILY":
      return addDays(today, 1);

    case "WEEKLY":
    case "BIWEEKLY": {
      const target = payday.weekday;
      if (target === null || target === undefined) return null;
      const delta = (target - today.getUTCDay() + 7) % 7;
      return addDays(today, delta === 0 ? 7 : delta);
    }

    case "SEMIMONTHLY": {
      // The 15th and the last day of the month.
      const fifteenth = onDayOfMonth(today, 15);
      if (fifteenth > today) return fifteenth;

      const endOfMonth = onDayOfMonth(today, lastDayOfMonth(today));
      if (endOfMonth > today) return endOfMonth;

      return onDayOfMonth(addMonths(today, 1), 15);
    }

    case "MONTHLY": {
      const target = payday.dayOfMonth;
      if (target === null || target === undefined) return null;
      const thisMonth = onDayOfMonth(today, target);
      return thisMonth > today ? thisMonth : onDayOfMonth(addMonths(today, 1), target);
    }

    default:
      return null;
  }
}

export interface SuggestionOptions {
  /** Weekdays with no collection; the suggestion never lands on one. */
  nonCollectionDays?: readonly number[];
  /**
   * Days to wait after payday. One day is the safe default: the money is
   * still there, and the customer is not asked to pay before being paid.
   */
  graceDays?: number;
}

/**
 * Suggests the first due date of a new loan for this customer.
 * Returns null when there is nothing to base a suggestion on.
 */
export function suggestFirstDueDate(
  payday: Payday,
  from: Date = new Date(),
  options: SuggestionOptions = {},
): Date | null {
  const target = nextPayday(payday, from);
  if (!target) return null;

  const withGrace = addDays(target, Math.max(0, options.graceDays ?? 1));
  return nextCollectionDay(withGrace, options.nonCollectionDays ?? []);
}
