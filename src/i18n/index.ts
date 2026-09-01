/**
 * Translation lookup.
 *
 * `t()` resolves a dot separated key against the dictionary and applies
 * `{placeholder}` interpolation. A company can override any key at runtime
 * through the `Translation` table; those overrides are merged in as a flat
 * map so a rename never requires a deployment.
 */

import { es, type Dictionary } from "./es";

export type Locale = "es";

export const DEFAULT_LOCALE: Locale = "es";

const DICTIONARIES: Record<Locale, Dictionary> = { es };

export type TranslationOverrides = Readonly<Record<string, string>>;

export type Interpolations = Readonly<
  Record<string, string | number | null | undefined>
>;

function resolvePath(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      source,
    );
}

function interpolate(template: string, values?: Interpolations): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export interface TranslatorOptions {
  locale?: Locale;
  overrides?: TranslationOverrides;
}

export type Translator = (key: string, values?: Interpolations) => string;

export function createTranslator(options: TranslatorOptions = {}): Translator {
  const dictionary = DICTIONARIES[options.locale ?? DEFAULT_LOCALE];
  const overrides = options.overrides ?? {};

  return (key, values) => {
    const override = overrides[key];
    if (typeof override === "string" && override.length > 0) {
      return interpolate(override, values);
    }

    const resolved = resolvePath(dictionary, key);
    if (typeof resolved === "string") {
      return interpolate(resolved, values);
    }

    // Returning the key makes a missing translation obvious instead of blank.
    return key;
  };
}

/** Translator without company overrides, for server side and scripts. */
export const t: Translator = createTranslator();

/** Flattens the dictionary into "a.b.c" -> "text" for the labels editor. */
export function flattenDictionary(
  locale: Locale = DEFAULT_LOCALE,
): Record<string, string> {
  const result: Record<string, string> = {};

  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === "string") {
      result[prefix] = node;
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        walk(value, prefix ? `${prefix}.${key}` : key);
      }
    }
  };

  walk(DICTIONARIES[locale], "");
  return result;
}

export { es };
export type { Dictionary };
