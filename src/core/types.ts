/**
 * Domain enums mirrored as string unions.
 *
 * The pure calculation layer under src/core must stay independent from Prisma
 * so it can be unit tested without a database. These unions are kept in sync
 * with prisma/schema.prisma.
 */

/**
 * What the interest rate is a percentage *of*.
 *
 * "Le presto 100 mil al 20% a 30 días" means 20,000 of interest in total —
 * the whole loan costs 20%. Read the same 20 as a rate per installment and a
 * daily loan charges 20% thirty times over, which is not a rounding
 * difference: it is 600,000 instead of 20,000.
 */
export type RateBasis =
  /** The rate applies to the loan as a whole. */
  | "TOTAL"
  /** The rate applies to every installment, e.g. "5% mensual" over 12 months. */
  | "PER_PERIOD";

export const RATE_BASES: RateBasis[] = ["TOTAL", "PER_PERIOD"];

export type InterestMethod =
  | "FLAT"
  | "FRENCH"
  | "GERMAN"
  | "AMERICAN"
  | "CREDIT_LINE";

export type PaymentFrequency =
  | "DAILY"
  /// One day yes, one day no.
  | "EVERY_OTHER_DAY"
  /// Two fixed weekdays per week, e.g. Monday and Thursday.
  | "TWICE_WEEKLY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMIMONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY"
  | "SINGLE"
  /// Every N days, where N is set per loan.
  | "CUSTOM";

export type LoanStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "IN_ARREARS"
  | "PAID"
  | "WRITTEN_OFF";

export type InstallmentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "WAIVED";

export type LateFeeMode =
  | "NONE"
  | "PERCENT_OF_INSTALLMENT"
  | "PERCENT_PER_DAY"
  | "FIXED_PER_DAY"
  | "FIXED_ONCE";

export const INTEREST_METHODS: InterestMethod[] = [
  "FLAT",
  "FRENCH",
  "GERMAN",
  "AMERICAN",
  "CREDIT_LINE",
];

export const PAYMENT_FREQUENCIES: PaymentFrequency[] = [
  "DAILY",
  "EVERY_OTHER_DAY",
  "TWICE_WEEKLY",
  "WEEKLY",
  "BIWEEKLY",
  "SEMIMONTHLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "SINGLE",
  "CUSTOM",
];

/**
 * Frequencies whose period is shorter than a week.
 *
 * These skip a non-collection day instead of landing on it: with a daily loan
 * that is not collected on Sunday, Sunday is not a missed installment, the
 * installment simply moves to Monday and the plan runs one day longer.
 * Weekly and longer frequencies keep their anchor and only nudge the
 * individual date forward, so a monthly loan due on the 5th stays on the 5th.
 */
export function usesSequentialSkipping(
  frequency: PaymentFrequency,
  customIntervalDays?: number,
): boolean {
  if (frequency === "DAILY" || frequency === "EVERY_OTHER_DAY") return true;
  if (frequency === "CUSTOM") return (customIntervalDays ?? 1) < 7;
  return false;
}

/** Weekday numbers as JavaScript reports them. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const LATE_FEE_MODES: LateFeeMode[] = [
  "NONE",
  "PERCENT_OF_INSTALLMENT",
  "PERCENT_PER_DAY",
  "FIXED_PER_DAY",
  "FIXED_ONCE",
];
