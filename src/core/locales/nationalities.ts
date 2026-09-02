/**
 * Nationality suggestions.
 *
 * Free text, not a closed list: a Haitian customer in Santo Domingo or a
 * Venezuelan in Bogotá is ordinary, and a picker that cannot spell their
 * nationality is a picker that stops the loan. The suggestions cover the
 * countries the app knows plus the ones people in the region actually come
 * from, so the common case is one tap and the rest is still typeable.
 */

import { COUNTRIES } from "./countries";

/** Nationalities from outside the country catalogue, common in the region. */
const ADDITIONAL_NATIONALITIES = [
  "Boricua",
  "China",
  "Cubana",
  "Española",
  "Estadounidense",
  "Haitiana",
  "Italiana",
  "Jamaiquina",
  "Portuguesa",
] as const;

/** Alphabetical, so a long datalist stays scannable. */
export const NATIONALITY_SUGGESTIONS: readonly string[] = [
  ...new Set([
    ...COUNTRIES.map((country) => country.demonym),
    ...ADDITIONAL_NATIONALITIES,
  ]),
].sort((a, b) => a.localeCompare(b, "es"));
