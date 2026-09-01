/**
 * Money helpers.
 *
 * Every monetary amount is handled internally as an integer number of minor
 * units (cents). Floating point arithmetic is only used at the boundaries,
 * where we convert to and from the `Decimal(18, 2)` columns of the database.
 */

export type Cents = number;

const MINOR_UNIT_FACTOR = 100;

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
 * remainder one cent at a time starting from the first part. The result always
 * adds back up to `total`, which is what keeps a schedule from drifting.
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  if (parts <= 0) return [];
  const base = Math.floor(Math.abs(total) / parts);
  const sign = total < 0 ? -1 : 1;
  let remainder = Math.abs(total) - base * parts;

  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return sign * (base + extra);
  });
}

/**
 * Applies a percentage expressed in human terms (10 means 10%).
 */
export function percentOf(amount: Cents, percent: number): Cents {
  return roundCents((amount * percent) / 100);
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
