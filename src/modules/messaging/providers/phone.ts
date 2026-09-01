/**
 * Phone number normalization.
 *
 * WhatsApp requires E.164 without the leading "+". Numbers are typed by hand
 * in the field in every imaginable format, so we normalize aggressively and
 * fall back to a configurable country code when none is present.
 */

export interface NormalizeOptions {
  /** Digits of the default country code, e.g. "1" or "52". */
  defaultCountryCode?: string;
  /** National number length expected for the default country, e.g. 10. */
  nationalNumberLength?: number;
}

export function normalizePhoneNumber(
  raw: string,
  options: NormalizeOptions = {},
): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // A leading international prefix such as "00" or "011" means the rest is
  // already a full international number.
  if (!hadPlus) {
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("011") && digits.length > 11) {
      digits = digits.slice(3);
    }
  }

  const countryCode = options.defaultCountryCode?.replace(/\D/g, "") ?? "";
  const nationalLength = options.nationalNumberLength ?? 10;

  if (!hadPlus && countryCode) {
    // A bare national number gets the default country code prepended.
    if (digits.length === nationalLength) {
      digits = `${countryCode}${digits}`;
    } else if (
      digits.length === nationalLength + 1 &&
      digits.startsWith("0")
    ) {
      // National trunk prefix, e.g. "0809...".
      digits = `${countryCode}${digits.slice(1)}`;
    }
  }

  // E.164 allows at most 15 digits and needs at least a country code plus a
  // subscriber number.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Formats a normalized number for display, e.g. "+1 809 555 0123". */
export function formatPhoneNumber(normalized: string): string {
  return `+${normalized}`;
}
