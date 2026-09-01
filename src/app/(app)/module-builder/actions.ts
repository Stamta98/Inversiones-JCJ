"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import {
  CUSTOM_FIELD_TYPES,
  KEY_PATTERN,
  coerceFieldValue,
  slugifyKey,
  type CustomFieldType,
  type FieldOption,
} from "@/modules/builder/fields";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

const EXTENDABLE_KEYS = ["customer", "loan", "payment"] as const;

const entitySchema = z.object({
  name: z.string().trim().min(1),
  pluralName: z.string().trim().min(1),
  key: z.string().trim().optional(),
  icon: z.string().trim().optional(),
  description: z.string().trim().optional(),
  extendsKey: z.string().optional(),
});

const fieldSchema = z.object({
  entityId: z.string().min(1),
  label: z.string().trim().min(1),
  key: z.string().trim().optional(),
  type: z.enum(CUSTOM_FIELD_TYPES as [CustomFieldType, ...CustomFieldType[]]),
  isRequired: z.string().optional(),
  showInList: z.string().optional(),
  helpText: z.string().trim().optional(),
  optionsText: z.string().optional(),
});

export interface BuilderFormState {
  error?: string;
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

/**
 * Parses the options textarea. One option per line, either "valor|Etiqueta"
 * or just the label, in which case the value is derived from it.
 */
function parseOptions(text: string | undefined): FieldOption[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue, rawLabel] = line.split("|");
      const label = (rawLabel ?? rawValue).trim();
      const value = rawLabel ? rawValue.trim() : slugifyKey(rawValue);
      return { value, label };
    });
}

export async function createEntity(
  _previous: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const context = await requirePermission("moduleBuilder.create");
  const parsed = entitySchema.safeParse(formEntries(formData));

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;
  const key = data.key?.trim() || slugifyKey(data.name);

  if (!KEY_PATTERN.test(key)) {
    return { error: t("moduleBuilder.errors.keyFormat") };
  }

  const extendsKey =
    data.extendsKey && EXTENDABLE_KEYS.includes(data.extendsKey as never)
      ? data.extendsKey
      : null;

  try {
    await db.customEntity.create({
      data: {
        companyId: context.companyId,
        key,
        name: data.name,
        pluralName: data.pluralName,
        icon: data.icon || "blocks",
        description: data.description || null,
        extendsKey,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { error: t("moduleBuilder.errors.keyTaken") };
    }
    throw error;
  }

  revalidatePath("/module-builder");
  redirect(`/module-builder/${key}`);
}

export async function createField(
  _previous: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const context = await requirePermission("moduleBuilder.update");
  const parsed = fieldSchema.safeParse(formEntries(formData));

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;
  const entity = await db.customEntity.findFirst({
    where: { id: data.entityId, companyId: context.companyId },
    include: { fields: { select: { key: true } } },
  });
  if (!entity) return { error: t("common.error") };

  const key = data.key?.trim() || slugifyKey(data.label);
  if (!KEY_PATTERN.test(key)) {
    return { error: t("moduleBuilder.errors.keyFormat") };
  }
  if (entity.fields.some((field) => field.key === key)) {
    return { error: t("moduleBuilder.errors.fieldKeyTaken") };
  }

  await db.customField.create({
    data: {
      entityId: entity.id,
      key,
      label: data.label,
      type: data.type,
      isRequired: data.isRequired === "on",
      showInList: data.showInList === "on",
      helpText: data.helpText || null,
      options: parseOptions(data.optionsText) as unknown as Prisma.InputJsonValue,
      sortOrder: entity.fields.length,
    },
  });

  revalidatePath(`/module-builder/${entity.key}`);
  return {};
}

export async function deleteField(formData: FormData): Promise<void> {
  const context = await requirePermission("moduleBuilder.update");
  const fieldId = String(formData.get("fieldId") ?? "");

  const field = await db.customField.findFirst({
    where: { id: fieldId, entity: { companyId: context.companyId } },
    include: { entity: { select: { key: true } } },
  });
  if (!field) return;

  await db.customField.delete({ where: { id: fieldId } });
  revalidatePath(`/module-builder/${field.entity.key}`);
}

/** Saves a record of a user defined module. */
export async function createRecord(
  _previous: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const context = await requirePermission("moduleBuilder.create");
  const entityId = String(formData.get("entityId") ?? "");

  const entity = await db.customEntity.findFirst({
    where: { id: entityId, companyId: context.companyId },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!entity) return { error: t("common.error") };

  const data: Record<string, unknown> = {};
  for (const field of entity.fields) {
    const value = coerceFieldValue(
      field.type as CustomFieldType,
      formData.get(`field_${field.key}`),
    );
    if (field.isRequired && (value === null || value === "")) {
      return { error: t("validation.required") };
    }
    data[field.key] = value;
  }

  await db.customRecord.create({
    data: {
      companyId: context.companyId,
      entityId: entity.id,
      ownerId: String(formData.get("ownerId") ?? "") || null,
      data: data as never,
    },
  });

  revalidatePath(`/module-builder/${entity.key}`);
  return {};
}
