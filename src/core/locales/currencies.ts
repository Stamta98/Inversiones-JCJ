/**
 * Currency catalogue for Latin America.
 *
 * Two things vary by country and both are visible to the user: the symbol and
 * how many decimals the amount is written with. Colombian and Chilean pesos are
 * written without cents — showing "$1.250,00" instead of "$1.250" reads as a
 * mistake to anyone there — while the Dominican peso uses two.
 *
 * `defaultDecimals` is only a starting point. A company can override it, which
 * is why nothing here is treated as fixed.
 */

export interface Currency {
  /** ISO 4217 code, the value stored on the company. */
  code: string;
  /** Name as it is said in Spanish, for the picker. */
  name: string;
  symbol: string;
  /** How the amount is normally written where this currency is used. */
  defaultDecimals: 0 | 2;
}

export const CURRENCIES: readonly Currency[] = [
  { code: "ARS", name: "Peso argentino", symbol: "$", defaultDecimals: 2 },
  { code: "BOB", name: "Boliviano", symbol: "Bs", defaultDecimals: 2 },
  { code: "BRL", name: "Real brasileño", symbol: "R$", defaultDecimals: 2 },
  // Colombia quotes whole pesos; cents disappeared from daily use long ago.
  { code: "COP", name: "Peso colombiano", symbol: "$", defaultDecimals: 0 },
  { code: "CRC", name: "Colón costarricense", symbol: "₡", defaultDecimals: 2 },
  // ISO 4217 itself gives the Chilean peso zero decimals.
  { code: "CLP", name: "Peso chileno", symbol: "$", defaultDecimals: 0 },
  { code: "DOP", name: "Peso dominicano", symbol: "RD$", defaultDecimals: 2 },
  { code: "GTQ", name: "Quetzal", symbol: "Q", defaultDecimals: 2 },
  { code: "HNL", name: "Lempira", symbol: "L", defaultDecimals: 2 },
  { code: "MXN", name: "Peso mexicano", symbol: "$", defaultDecimals: 2 },
  { code: "NIO", name: "Córdoba", symbol: "C$", defaultDecimals: 2 },
  { code: "PAB", name: "Balboa", symbol: "B/.", defaultDecimals: 2 },
  { code: "PEN", name: "Sol peruano", symbol: "S/", defaultDecimals: 2 },
  { code: "PYG", name: "Guaraní", symbol: "₲", defaultDecimals: 0 },
  {
    code: "USD",
    name: "Dólar estadounidense",
    symbol: "US$",
    defaultDecimals: 2,
  },
  { code: "UYU", name: "Peso uruguayo", symbol: "$U", defaultDecimals: 2 },
  { code: "VES", name: "Bolívar", symbol: "Bs.", defaultDecimals: 2 },
];

export function findCurrency(code: string): Currency | null {
  const wanted = code.trim().toUpperCase();
  return CURRENCIES.find((currency) => currency.code === wanted) ?? null;
}

export function isSupportedCurrency(code: string): boolean {
  return findCurrency(code) !== null;
}

/**
 * Decimals to write an amount with. Falls back to two for an unknown code,
 * which is the safe choice: showing cents that are always zero is odd, hiding
 * cents that carry value is wrong.
 */
export function defaultDecimalsFor(code: string): 0 | 2 {
  return findCurrency(code)?.defaultDecimals ?? 2;
}
