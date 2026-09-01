/**
 * Display formatting. Always Spanish output, driven by the company's locale
 * and currency.
 */

import { fromCents, type Cents } from "@/core/money";

export function formatCurrency(
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

export function formatCentsAsCurrency(
  cents: Cents,
  currencyCode = "DOP",
  locale = "es-DO",
): string {
  return formatCurrency(fromCents(cents), currencyCode, locale);
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

export function formatLongDate(
  value: Date | string,
  locale = "es-DO",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(
  value: Date | string,
  locale = "es-DO",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
