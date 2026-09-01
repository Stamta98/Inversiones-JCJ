/**
 * Repayment schedule generation.
 *
 * Pure functions: no database, no I/O. Amounts are in cents so that the sum of
 * the installments always equals the total of the loan, with no drift.
 */

import { advanceByFrequency, startOfDay } from "../dates";
import {
  addCents,
  percentOf,
  roundCents,
  splitEvenly,
  type Cents,
} from "../money";
import type { InterestMethod, PaymentFrequency } from "../types";

export interface ScheduleInput {
  principalCents: Cents;
  /** Interest rate per period as a percentage. 10 means 10% per period. */
  interestRate: number;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  /** Number of installments. Ignored for SINGLE, which always produces one. */
  termCount: number;
  firstDueDate: Date;
}

export interface ScheduledInstallment {
  number: number;
  dueDate: Date;
  principalCents: Cents;
  interestCents: Cents;
  totalCents: Cents;
  /** Outstanding principal once this installment is paid. */
  balanceAfterCents: Cents;
}

export interface Schedule {
  installments: ScheduledInstallment[];
  totalPrincipalCents: Cents;
  totalInterestCents: Cents;
  totalToPayCents: Cents;
  /** True when the loan has no fixed end date (revolving credit line). */
  isOpenEnded: boolean;
}

export class ScheduleError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

function assertValidInput(input: ScheduleInput): void {
  if (input.principalCents <= 0) {
    throw new ScheduleError("Principal must be greater than zero", "principal");
  }
  if (input.interestRate < 0) {
    throw new ScheduleError("Interest rate cannot be negative", "interestRate");
  }
  if (!Number.isInteger(input.termCount) || input.termCount <= 0) {
    throw new ScheduleError(
      "Term must be a positive whole number",
      "termCount",
    );
  }
  if (Number.isNaN(input.firstDueDate.getTime())) {
    throw new ScheduleError("First due date is invalid", "firstDueDate");
  }
}

function dueDates(input: ScheduleInput, count: number): Date[] {
  const anchor = startOfDay(input.firstDueDate);
  return Array.from({ length: count }, (_, index) =>
    advanceByFrequency(anchor, input.frequency, index),
  );
}

/**
 * Flat rate: the interest of the whole term is computed once over the original
 * principal and then split evenly. This is the model behind "10% mensual"
 * street lending, and the reason its effective cost is far above the headline.
 */
function buildFlatSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const count = input.termCount;
  const interestPerPeriod = percentOf(input.principalCents, input.interestRate);
  const totalInterest = interestPerPeriod * count;

  const principalParts = splitEvenly(input.principalCents, count);
  const interestParts = splitEvenly(totalInterest, count);
  const dates = dueDates(input, count);

  let balance = input.principalCents;
  return principalParts.map((principalCents, index) => {
    balance -= principalCents;
    return {
      number: index + 1,
      dueDate: dates[index],
      principalCents,
      interestCents: interestParts[index],
      totalCents: principalCents + interestParts[index],
      balanceAfterCents: balance,
    };
  });
}

/**
 * French system: a constant installment, with interest charged on the
 * outstanding balance so the principal share grows every period.
 */
function buildFrenchSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const count = input.termCount;
  const rate = input.interestRate / 100;
  const dates = dueDates(input, count);

  if (rate === 0) {
    return buildGermanSchedule({ ...input, interestRate: 0 });
  }

  const factor = Math.pow(1 + rate, -count);
  const installmentCents = roundCents(
    (input.principalCents * rate) / (1 - factor),
  );

  const firstPeriodInterest = roundCents(input.principalCents * rate);
  if (installmentCents <= firstPeriodInterest) {
    throw new ScheduleError(
      "The installment does not cover the interest; lower the rate or extend the term",
      "interestRate",
    );
  }

  const installments: ScheduledInstallment[] = [];
  let balance = input.principalCents;

  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const interestCents = roundCents(balance * rate);
    const principalCents = isLast
      ? balance
      : Math.min(installmentCents - interestCents, balance);

    balance -= principalCents;
    installments.push({
      number: index + 1,
      dueDate: dates[index],
      principalCents,
      interestCents,
      totalCents: principalCents + interestCents,
      balanceAfterCents: balance,
    });
  }

  return installments;
}

/**
 * German system: a constant principal share, so the installment decreases as
 * the balance goes down.
 */
function buildGermanSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const count = input.termCount;
  const rate = input.interestRate / 100;
  const principalParts = splitEvenly(input.principalCents, count);
  const dates = dueDates(input, count);

  let balance = input.principalCents;
  return principalParts.map((principalCents, index) => {
    const interestCents = roundCents(balance * rate);
    balance -= principalCents;
    return {
      number: index + 1,
      dueDate: dates[index],
      principalCents,
      interestCents,
      totalCents: principalCents + interestCents,
      balanceAfterCents: balance,
    };
  });
}

/**
 * American system: interest only every period, the whole principal falls due
 * with the last installment.
 */
function buildAmericanSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const count = input.termCount;
  const interestPerPeriod = percentOf(input.principalCents, input.interestRate);
  const dates = dueDates(input, count);

  return dates.map((dueDate, index) => {
    const isLast = index === count - 1;
    const principalCents = isLast ? input.principalCents : 0;
    return {
      number: index + 1,
      dueDate,
      principalCents,
      interestCents: interestPerPeriod,
      totalCents: principalCents + interestPerPeriod,
      balanceAfterCents: isLast ? 0 : input.principalCents,
    };
  });
}

/**
 * Credit line: an open ended loan where only interest is scheduled and the
 * principal stays outstanding until the customer decides to repay it. The
 * generated rows are a rolling horizon, not a closed plan.
 */
function buildCreditLineSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const interestPerPeriod = percentOf(input.principalCents, input.interestRate);
  return dueDates(input, input.termCount).map((dueDate, index) => ({
    number: index + 1,
    dueDate,
    principalCents: 0,
    interestCents: interestPerPeriod,
    totalCents: interestPerPeriod,
    balanceAfterCents: input.principalCents,
  }));
}

const BUILDERS: Record<
  InterestMethod,
  (input: ScheduleInput) => ScheduledInstallment[]
> = {
  FLAT: buildFlatSchedule,
  FRENCH: buildFrenchSchedule,
  GERMAN: buildGermanSchedule,
  AMERICAN: buildAmericanSchedule,
  CREDIT_LINE: buildCreditLineSchedule,
};

export function buildSchedule(input: ScheduleInput): Schedule {
  assertValidInput(input);

  const normalized: ScheduleInput =
    input.frequency === "SINGLE" ? { ...input, termCount: 1 } : input;

  const builder = BUILDERS[normalized.interestMethod];
  if (!builder) {
    throw new ScheduleError(
      `Unsupported interest method: ${normalized.interestMethod}`,
      "interestMethod",
    );
  }

  const installments = builder(normalized);
  const totalPrincipalCents = addCents(
    ...installments.map((installment) => installment.principalCents),
  );
  const totalInterestCents = addCents(
    ...installments.map((installment) => installment.interestCents),
  );

  return {
    installments,
    totalPrincipalCents,
    totalInterestCents,
    totalToPayCents: totalPrincipalCents + totalInterestCents,
    isOpenEnded: normalized.interestMethod === "CREDIT_LINE",
  };
}
