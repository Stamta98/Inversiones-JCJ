/**
 * Domain enums mirrored as string unions.
 *
 * The pure calculation layer under src/core must stay independent from Prisma
 * so it can be unit tested without a database. These unions are kept in sync
 * with prisma/schema.prisma.
 */

export type InterestMethod =
  | "FLAT"
  | "FRENCH"
  | "GERMAN"
  | "AMERICAN"
  | "CREDIT_LINE";

export type PaymentFrequency =
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMIMONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY"
  | "SINGLE";

export type LoanStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "IN_ARREARS"
  | "PAID"
  | "CANCELLED"
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
  "WEEKLY",
  "BIWEEKLY",
  "SEMIMONTHLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "SINGLE",
];

export const LATE_FEE_MODES: LateFeeMode[] = [
  "NONE",
  "PERCENT_OF_INSTALLMENT",
  "PERCENT_PER_DAY",
  "FIXED_PER_DAY",
  "FIXED_ONCE",
];
