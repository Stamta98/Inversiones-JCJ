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

/**
 * El día de calendario en que ocurrió algo, visto desde la oficina.
 *
 * `disbursedAt`, `createdAt` o `closingDate` no son días: son instantes, la
 * hora exacta en que se hizo. Guardados en UTC, un préstamo entregado a las
 * ocho de la noche en Colombia queda con fecha del día siguiente, y así se
 * pintaba en la pantalla: "inició" un día después de que salió la plata.
 *
 * Esto los baja al día que la persona vio en el reloj de la pared, devuelto
 * a medianoche UTC para que se pueda comparar y pintar igual que una fecha
 * de cuota, que sí se guarda como día suelto.
 */
export function dayIn(date: Date, timeZone: string): Date {
  // "en-CA" da el año-mes-día en ese orden y con guiones, que es justo lo
  // que hay que volver a leer.
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * El día que es hoy donde está la empresa.
 *
 * No es lo mismo que el día del servidor: en Vercel el servidor vive en UTC,
 * y en Colombia son cinco horas menos. Con `startOfDay(new Date())` el día
 * cambiaba a las siete de la noche, así que un cobro de las 7:30 p. m. caía
 * en el resumen del día siguiente y el de hoy quedaba diciendo de menos.
 */
export function todayIn(timeZone: string): Date {
  return dayIn(new Date(), timeZone);
}

/**
 * Cuánto se adelanta o se atrasa una zona respecto de UTC en ese instante.
 *
 * Se pregunta por el instante y no por la zona a secas porque hay países que
 * cambian la hora: el mismo sitio está a −5 en enero y a −4 en julio.
 */
function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asIfUtc - at.getTime();
}

/**
 * El instante en que empieza ese día donde está la empresa.
 *
 * Los días se anclan a medianoche UTC para poder compararlos sin ambigüedad,
 * pero el momento en que ese día de verdad empieza depende de dónde se
 * cobra: la medianoche del 7 de septiembre en Colombia son las 05:00 UTC.
 */
export function startOfDayIn(day: Date, timeZone: string): Date {
  const wall = day.getTime();
  // Dos pasadas: la primera calcula el desfase con una hora aproximada, la
  // segunda lo corrige si esa hora caía del otro lado de un cambio de hora.
  const first = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(first), timeZone));
}

/**
 * El día completo de la empresa, en instantes, para filtrar con él.
 *
 * Es lo que hace que el resumen del día cuadre. Filtrando por horas UTC, un
 * préstamo entregado a las siete de la noche en Colombia —que son las cero
 * horas del día siguiente en UTC— aparecía en el resumen de mañana, mientras
 * el abono que se recibió en ese mismo momento aparecía en el de hoy: las dos
 * mitades del mismo resumen contaban días distintos.
 *
 * Sirve igual para las columnas que guardan un día en vez de un instante —los
 * cobros se anclan al mediodía UTC—, porque el mediodía de un día cae dentro
 * de la ventana de ese mismo día en todo el continente.
 */
export function dayWindowIn(
  day: Date,
  timeZone: string,
): { gte: Date; lt: Date } {
  return {
    gte: startOfDayIn(day, timeZone),
    lt: startOfDayIn(addDays(day, 1), timeZone),
  };
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
/**
 * El día de inicio del que sale esta primera cuota.
 *
 * Lo contrario de `firstDueAfter`: el formulario pregunta cuándo empieza el
 * préstamo y calcula la cuota, pero al abrir uno ya hecho solo se tiene la
 * cuota y hay que volver atrás para llenar la casilla.
 *
 * Es un período antes. Para las frecuencias de verdad —diaria, semanal,
 * quincenal, mensual— vuelve exacto: adelantar un período desde aquí devuelve
 * la misma cuota. Las raras (dos veces por semana, pago único) no invierten
 * limpio, y por eso la pantalla siempre enseña la cuota que va a quedar en
 * vez de dar por hecho que no se movió.
 */
export function startForFirstDue(
  firstDue: Date,
  frequency: PaymentFrequency,
  options: { customIntervalDays?: number } = {},
): Date {
  return advanceByFrequency(
    startOfDay(firstDue),
    frequency,
    -1,
    options.customIntervalDays ?? 1,
  );
}

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
