"use server";

import { revalidatePath } from "next/cache";

import { dependentModuleKeys, getModule } from "@/core/modules/registry";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

/**
 * Turns a module on or off for the company. Disabling a module also disables
 * anything that depends on it, so the navigation can never point at a screen
 * whose data source is gone.
 */
export async function toggleModule(formData: FormData): Promise<void> {
  const context = await requirePermission("settings.update");
  const moduleKey = String(formData.get("moduleKey") ?? "");

  const definition = getModule(moduleKey);
  if (!definition || !definition.isRemovable) return;

  const current = await db.moduleInstallation.findUnique({
    where: {
      companyId_moduleKey: { companyId: context.companyId, moduleKey },
    },
  });

  const nextEnabled = !(current?.isEnabled ?? true);

  await db.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: { companyId: context.companyId, moduleKey },
    },
    create: {
      companyId: context.companyId,
      moduleKey,
      isEnabled: nextEnabled,
      sortOrder: definition.sortOrder,
    },
    update: { isEnabled: nextEnabled },
  });

  if (!nextEnabled) {
    const dependents = dependentModuleKeys(moduleKey).filter((key) => {
      const dependent = getModule(key);
      return dependent?.isRemovable;
    });

    if (dependents.length > 0) {
      await db.moduleInstallation.updateMany({
        where: { companyId: context.companyId, moduleKey: { in: dependents } },
        data: { isEnabled: false },
      });
    }
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

/**
 * Saves the company's label overrides. An empty value removes the override and
 * the original Spanish text comes back.
 */
export async function saveLabels(formData: FormData): Promise<void> {
  const context = await requirePermission("settings.update");
  const locale = context.locale;

  for (const [name, rawValue] of formData.entries()) {
    if (!name.startsWith("label_")) continue;

    const key = name.slice("label_".length);
    const value = String(rawValue).trim();

    if (value.length === 0) {
      await db.translation.deleteMany({
        where: { companyId: context.companyId, locale, key },
      });
      continue;
    }

    await db.translation.upsert({
      where: {
        companyId_locale_key: { companyId: context.companyId, locale, key },
      },
      create: { companyId: context.companyId, locale, key, value },
      update: { value },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
