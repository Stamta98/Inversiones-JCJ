/**
 * Display formatting. Always Spanish output, driven by the company's locale
 * and currency.
 */

import { defaultDecimalsFor } from "@/core/locales/currencies";
import { fromCents, type Cents } from "@/core/money";

/**
 * Decimals are not fixed at two: Colombian and Chilean pesos are written
 * without cents, and "$1.250,00" reads as a mistake to anyone there. The
 * company can override the default its currency implies.
 */
export function formatCurrency(
  amount: number,
  currencyCode = "DOP",
  locale = "es-DO",
  decimals?: number,
): string {
  const fractionDigits = decimals ?? defaultDecimalsFor(currencyCode);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatCentsAsCurrency(
  cents: Cents,
  currencyCode = "DOP",
  locale = "es-DO",
  decimals?: number,
): string {
  return formatCurrency(fromCents(cents), currencyCode, locale, decimals);
}

export function formatNumber(value: number, locale = "es-DO"): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(value: Date | string, locale = "es-DO"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatLongDate(value: Date | string, locale = "es-DO"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Fecha y hora, en la zona de la empresa y con el reloj de veinticuatro.
 *
 * Sin `hourCycle` el español escribe «08:30 p. m.», que en una tabla de
 * cobros del día se lee dos veces: una para el número y otra para el «p. m.».
 * Y sin `timeZone` la hora sale en la del servidor —en Vercel, UTC— así que
 * un cobro de las siete de la noche en Colombia salía a la medianoche y con
 * fecha del día siguiente.
 */
export function formatDateTime(
  value: Date | string,
  locale = "es-DO",
  timeZone?: string,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/**
 * La hora sola, en la zona de la empresa.
 *
 * Las fechas de un cobro se guardan al mediodía UTC —  el día lo escoge la
 * persona en un calendario, sin hora — así que la hora de verdad, la de
 * cuando se registró, está en `createdAt`.
 */
export function formatTime(
  value: Date | string,
  locale = "es-DO",
  timeZone?: string,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/** Turns a Prisma Decimal, a string or a number into a plain number. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return Number(value ?? 0);
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
