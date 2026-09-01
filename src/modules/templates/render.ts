/**
 * Template rendering.
 *
 * Replaces {{placeholders}} in a template body with values taken from a
 * context object. Both the canonical English token and its Spanish alias
 * resolve to the same value.
 */

import { canonicalVariableKey, isKnownVariable } from "./variables";

const PLACEHOLDER_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

export type TemplateContext = Readonly<Record<string, unknown>>;

export interface RenderOptions {
  /** Text used when a known variable has no value in this context. */
  fallback?: string;
  /**
   * When true, an unknown variable throws instead of being left in place.
   * Used by the template editor to catch typos before saving.
   */
  strict?: boolean;
}

export class TemplateRenderError extends Error {
  constructor(
    message: string,
    readonly variableName: string,
  ) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

function readPath(context: TemplateContext, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      context,
    );
}

export function renderTemplate(
  body: string,
  context: TemplateContext,
  options: RenderOptions = {},
): string {
  const fallback = options.fallback ?? "";

  return body.replace(PLACEHOLDER_PATTERN, (match, rawToken: string) => {
    const token = rawToken.trim();

    if (!isKnownVariable(token)) {
      if (options.strict) {
        throw new TemplateRenderError(
          `Unknown template variable: ${token}`,
          token,
        );
      }
      return match;
    }

    const key = canonicalVariableKey(token);
    const value = readPath(context, key);

    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    return String(value);
  });
}

/** Every placeholder found in a body, canonicalized and de-duplicated. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    found.add(canonicalVariableKey(match[1].trim()));
  }
  return [...found];
}

/** Placeholders that do not exist in the catalogue. */
export function findUnknownVariables(body: string): string[] {
  const unknown = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const token = match[1].trim();
    if (!isKnownVariable(token)) unknown.add(token);
  }
  return [...unknown];
}
