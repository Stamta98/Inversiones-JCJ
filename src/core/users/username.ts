/**
 * Usernames.
 *
 * People sign in with a username or with their email, so the two live in the
 * same namespace and must never be confusable: an `@` is what tells them
 * apart, and that is why it can never appear inside a username.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Lowercase letters, digits, dot, underscore and hyphen, starting and ending
 * with a letter or a digit. No accents: a username has to be typeable on any
 * keyboard, including a phone with the wrong layout.
 */
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

/** Case and spacing never distinguish two accounts. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  const username = normalizeUsername(value);
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}

/** What the sign-in form was given: an email, or a username. */
export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

/**
 * Builds a usable username out of whatever we have — an email or a full name.
 *
 * Only a suggestion: the caller still has to check that nobody else took it.
 */
export function suggestUsername(source: string): string {
  const base = looksLikeEmail(source) ? source.split("@")[0]! : source;

  const cleaned = base
    .normalize("NFD")
    // Drop the accent marks NFD just split off, keeping the plain letter.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/[._-]+$/, "");

  if (cleaned.length === 0) return "";
  // Too short to be accepted: pad rather than hand back something invalid.
  return cleaned.length < USERNAME_MIN_LENGTH
    ? `${cleaned}${"0".repeat(USERNAME_MIN_LENGTH - cleaned.length)}`
    : cleaned;
}
