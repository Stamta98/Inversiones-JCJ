/**
 * Money helpers.
 *
 * Every monetary amount is handled internally as an integer number of minor
 * units (cents). Floating point arithmetic is only used at the boundaries,
 * where we convert to and from the `Decimal(18, 2)` columns of the database.
 */

export type Cents = number;

const MINOR_UNIT_FACTOR = 100;

/**
 * Smallest amount that can actually be charged, in cents.
 *
 * Two decimals means a cent is chargeable, so the step is 1. Zero decimals
 * means the smallest real amount is a whole unit: there is no such thing as
 * half a Colombian peso, so the step is 100. Working in steps is what keeps a
 * schedule from adding up to 99.999 when the loan was for 100.000.
 */
export type MinorUnitStep = 1 | 100;

export function stepForDecimals(decimals: number): MinorUnitStep {
  return decimals === 0 ? 100 : 1;
}

/** Rounds to the nearest amount that can actually be charged. */
export function roundToStep(value: number, step: MinorUnitStep = 1): Cents {
  if (step === 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/** Converts a major unit amount (12.34) into cents (1234). */
export function toCents(amount: number | string): Cents {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot convert "${amount}" to cents`);
  }
  return Math.round(value * MINOR_UNIT_FACTOR);
}

/** Converts cents (1234) back into major units (12.34). */
export function fromCents(cents: Cents): number {
  return Math.round(cents) / MINOR_UNIT_FACTOR;
}

/** Rounds a fractional cents value to the nearest whole cent. */
export function roundCents(value: number): Cents {
  return Math.round(value);
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

export function clampToZero(value: Cents): Cents {
  return value < 0 ? 0 : value;
}

/**
 * Splits an amount into `parts` as evenly as possible, distributing the
 * remainder one step at a time starting from the first part.
 *
 * Every part is a multiple of `step`, and they add back up to `total` rounded
 * to that step. Both properties matter: a part that cannot be charged is not a
 * real installment, and parts that do not add up leave a loan that never
 * settles.
 */
export function splitEvenly(
  total: Cents,
  parts: number,
  step: MinorUnitStep = 1,
): Cents[] {
  if (parts <= 0) return [];

  const sign = total < 0 ? -1 : 1;
  // Count in whole steps, so nothing below a chargeable amount survives.
  const units = Math.round(Math.abs(total) / step);
  const base = Math.floor(units / parts);
  let remainder = units - base * parts;

  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return sign * (base + extra) * step;
  });
}

/**
 * Applies a percentage expressed in human terms (10 means 10%), rounded to an
 * amount that can actually be charged.
 */
export function percentOf(
  amount: Cents,
  percent: number,
  step: MinorUnitStep = 1,
): Cents {
  return roundToStep((amount * percent) / 100, step);
}

/** Formats an amount for display. Labels stay in the UI layer. */
export function formatMoney(
  amount: number,
  currencyCode = "DOP",
  locale = "es-DO",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
