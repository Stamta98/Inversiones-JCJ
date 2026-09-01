/**
 * Custom field helpers shared by the builder UI and the record forms.
 */

export type CustomFieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "CURRENCY"
  | "DATE"
  | "DATETIME"
  | "BOOLEAN"
  | "SELECT"
  | "MULTI_SELECT"
  | "PHONE"
  | "EMAIL"
  | "URL"
  | "FILE";

export const CUSTOM_FIELD_TYPES: CustomFieldType[] = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "PHONE",
  "EMAIL",
  "URL",
  "FILE",
];

export const FIELD_TYPES_WITH_OPTIONS: CustomFieldType[] = [
  "SELECT",
  "MULTI_SELECT",
];

export interface FieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  isRequired: boolean;
  showInList: boolean;
  helpText: string | null;
  defaultValue: string | null;
  options: FieldOption[];
}

/** Keys must be safe as a JSON property and as a form field name. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/**
 * Turns a Spanish label into a usable internal key:
 * "Fecha de visita" -> "fecha_de_visita".
 */
export function slugifyKey(label: string): string {
  const normalized = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // A key has to start with a letter to stay a valid identifier.
  return /^[a-z]/.test(normalized) ? normalized : `campo_${normalized}`;
}

/** The HTML input type that best matches a field type. */
export function inputTypeFor(type: CustomFieldType): string {
  switch (type) {
    case "NUMBER":
    case "CURRENCY":
      return "number";
    case "DATE":
      return "date";
    case "DATETIME":
      return "datetime-local";
    case "BOOLEAN":
      return "checkbox";
    case "PHONE":
      return "tel";
    case "EMAIL":
      return "email";
    case "URL":
      return "url";
    case "FILE":
      return "file";
    default:
      return "text";
  }
}

/** Coerces a submitted form value into the shape stored in the JSON column. */
export function coerceFieldValue(
  type: CustomFieldType,
  raw: FormDataEntryValue | null,
): unknown {
  if (type === "BOOLEAN") return raw === "on" || raw === "true";
  if (raw === null) return null;

  const value = String(raw).trim();
  if (value.length === 0) return null;

  if (type === "NUMBER" || type === "CURRENCY") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === "MULTI_SELECT") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}

/** Renders a stored value as display text. */
export function formatFieldValue(
  type: CustomFieldType,
  value: unknown,
  options: FieldOption[] = [],
): string {
  if (value === null || value === undefined || value === "") return "—";

  if (type === "BOOLEAN") return value ? "Sí" : "No";

  if (type === "SELECT") {
    return (
      options.find((option) => option.value === value)?.label ?? String(value)
    );
  }

  if (type === "MULTI_SELECT" && Array.isArray(value)) {
    return value
      .map(
        (item) =>
          options.find((option) => option.value === item)?.label ?? String(item),
      )
      .join(", ");
  }

  return String(value);
}

/**
 * Narrows the `options` JSON column into typed options, discarding anything
 * that does not have both a value and a label.
 */
export function toFieldOptions(value: unknown): FieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.value !== "string" ||
      typeof candidate.label !== "string"
    ) {
      return [];
    }
    return [{ value: candidate.value, label: candidate.label }];
  });
}
