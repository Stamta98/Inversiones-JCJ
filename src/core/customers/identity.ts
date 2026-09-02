/**
 * Who the customer is: how they identify and how old they are.
 *
 * The age matters beyond the birthday card — it goes on the contract, and a
 * date typed a digit wrong (2926 instead of 1926) has to be caught at the
 * form rather than discovered years later on a legal document.
 */

export const GENDERS = ["FEMALE", "MALE", "OTHER"] as const;

export type Gender = (typeof GENDERS)[number];

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

/** Nobody alive is older than this, so anything beyond it is a typo. */
export const MAX_AGE_YEARS = 120;

/** Completed years on a given day, or null when there is no birth date. */
export function ageOn(
  birthDate: Date | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!birthDate) return null;

  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();

  // The birthday has not come round yet this year.
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

/** A date that could belong to a living person, born already. */
export function isPlausibleBirthDate(
  birthDate: Date,
  today: Date = new Date(),
): boolean {
  if (Number.isNaN(birthDate.getTime())) return false;

  const age = ageOn(birthDate, today);
  return age !== null && age >= 0 && age <= MAX_AGE_YEARS;
}
