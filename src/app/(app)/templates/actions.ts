"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { findUnknownVariables } from "@/modules/templates/render";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

const KEY_PATTERN = /^[a-z0-9_]+$/;

const templateSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().min(1).regex(KEY_PATTERN),
  name: z.string().trim().min(1),
  kind: z.enum([
    "WHATSAPP",
    "SMS",
    "EMAIL",
    "DOCUMENT",
    "RECEIPT",
    "CONTRACT",
  ]),
  subject: z.string().optional(),
  body: z.string().trim().min(1),
  description: z.string().optional(),
});

export interface TemplateFormState {
  error?: string;
}

export async function saveTemplate(
  _previous: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const context = await requirePermission([
    "templates.create",
    "templates.update",
  ]);

  const parsed = templateSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) {
    return { error: t("common.error") };
  }

  const data = parsed.data;

  // Catch a mistyped placeholder before it reaches a customer.
  const unknown = findUnknownVariables(data.body);
  if (unknown.length > 0) {
    return { error: t("templates.unknownVariable", { name: unknown[0] }) };
  }

  const payload = {
    name: data.name,
    kind: data.kind,
    subject: data.subject || null,
    body: data.body,
    description: data.description || null,
  };

  try {
    if (data.id) {
      await db.template.update({
        where: { id: data.id, companyId: context.companyId },
        data: payload,
      });
    } else {
      await db.template.create({
        data: { companyId: context.companyId, key: data.key, ...payload },
      });
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { error: t("validation.unique") };
    }
    throw error;
  }

  revalidatePath("/templates");
  redirect("/templates");
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const context = await requirePermission("templates.delete");
  const id = String(formData.get("id") ?? "");

  await db.template.deleteMany({
    where: { id, companyId: context.companyId, isSystem: false },
  });

  revalidatePath("/templates");
}
