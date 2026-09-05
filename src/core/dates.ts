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

/**
 * El día que viene escrito en una dirección: "2026-08-05".
 *
 * Devuelve null cuando no es una fecha de verdad — un mes trece, un texto
 * cualquiera — para que quien la lea decida qué hacer en vez de quedarse con
 * un "Invalid Date" que se cuela hasta la consulta.
 */
export function parseDay(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Un 31 de febrero se convierte solo en marzo: si los números no vuelven
  // iguales, la fecha no existía.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/** El día como se escribe en una dirección: "2026-08-05". */
export function dayParam(date: Date): string {
  return date.toISOString().slice(0, 10);
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
  customIntervalDays = 1,
): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(anchor, periods);
    case "EVERY_OTHER_DAY":
      return addDays(anchor, 2 * periods);
    case "TWICE_WEEKLY": {
      // Two fixed weekdays a week: alternating 3 and 4 days always lands on
      // the same pair, e.g. Monday and Thursday.
      const wholeWeeks = Math.floor(periods / 2);
      const hasSecondDay = periods % 2 === 1;
      return addDays(anchor, 7 * wholeWeeks + (hasSecondDay ? 3 : 0));
    }
    case "CUSTOM":
      return addDays(anchor, Math.max(1, customIntervalDays) * periods);
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

/** Day of week, 0 = Sunday through 6 = Saturday. */
export function weekdayOf(date: Date): number {
  return startOfDay(date).getUTCDay();
}

export class NoCollectionDayError extends Error {
  constructor() {
    super("At least one weekday must be available for collection");
    this.name = "NoCollectionDayError";
  }
}

/**
 * Moves a date forward until it lands on a day the business collects on.
 * A date that is already fine is returned untouched.
 */
export function nextCollectionDay(
  date: Date,
  nonCollectionDays: readonly number[] = [],
): Date {
  if (nonCollectionDays.length === 0) return startOfDay(date);
  if (nonCollectionDays.length >= 7) throw new NoCollectionDayError();

  const blocked = new Set(nonCollectionDays);
  let candidate = startOfDay(date);

  // At most six hops: with seven blocked days we already threw above.
  for (let hop = 0; hop < 7; hop += 1) {
    if (!blocked.has(candidate.getUTCDay())) return candidate;
    candidate = addDays(candidate, 1);
  }
  throw new NoCollectionDayError();
}

/**
 * Cuándo cae la primera cuota de un préstamo entregado hoy.
 *
 * El día que se entrega la plata no se cobra: se cobra un período después.
 * Diario prestado hoy es mañana; semanal prestado el sábado es el sábado de la
 * otra semana; mensual es el mismo día del mes que viene. Y si ese día cae en
 * uno en que no se sale a cobrar, se corre al siguiente que sí.
 */
export function firstDueAfter(
  disbursedAt: Date,
  frequency: PaymentFrequency,
  options: {
    customIntervalDays?: number;
    nonCollectionDays?: readonly number[];
  } = {},
): Date {
  const oneLater = advanceByFrequency(
    startOfDay(disbursedAt),
    frequency,
    1,
    options.customIntervalDays ?? 1,
  );

  // Un pago único no tiene "período siguiente": se cobra al día siguiente, que
  // es lo mismo que cobrarlo cuando toque, pero nunca el mismo día.
  const target =
    oneLater.getTime() === startOfDay(disbursedAt).getTime()
      ? addDays(startOfDay(disbursedAt), 1)
      : oneLater;

  return nextCollectionDay(target, options.nonCollectionDays ?? []);
}

/** How many payment periods fit in a year. Used to annualize a rate. */
export function periodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "DAILY":
      return 365;
    case "EVERY_OTHER_DAY":
      return 182;
    case "TWICE_WEEKLY":
      return 104;
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
    case "CUSTOM":
      return 365;
    default: {
      const exhaustive: never = frequency;
      throw new Error(`Unsupported frequency: ${String(exhaustive)}`);
    }
  }
}
