"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSupportedCurrency } from "@/core/locales/currencies";
import { findCountry } from "@/core/locales/countries";
import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export interface CompanyFormState {
  error?: string;
  success?: string;
}

/** Empty means "not filled in", not "saved as an empty string". */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value === undefined || value.length === 0 ? null : value,
  );

const optionalCoordinate = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined || value.length === 0) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

const schema = z.object({
  name: z.string().trim().min(1),
  legalName: optionalText,
  taxId: optionalText,
  email: optionalText.refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: "email" },
  ),
  phone: optionalText,
  address: optionalText,
  country: optionalText,
  city: optionalText,
  state: optionalText,
  officeLatitude: optionalCoordinate,
  officeLongitude: optionalCoordinate,
  logoUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? "")
    // Only files this app serves, never an arbitrary external URL.
    .refine((value) => value.length === 0 || value.startsWith("/api/files/"), {
      message: "logo",
    }),
  currencyCode: z.string().trim().toUpperCase(),
  decimalPlaces: z.coerce.number().int().min(0).max(2),
  locale: z.string().trim().min(2),
  timezone: z.string().trim().min(1),
});

export async function saveCompany(
  _previous: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const context = await requirePermission("settings.update");

  const parsed = schema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "email") return { error: t("validation.email") };
    return { error: t("common.error") };
  }

  const data = parsed.data;

  // A currency outside the catalogue would break every amount on screen.
  if (!isSupportedCurrency(data.currencyCode)) {
    return { error: t("common.error") };
  }
  if (data.country !== null && findCountry(data.country) === null) {
    return { error: t("common.error") };
  }

  await db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: context.companyId },
      data: {
        name: data.name,
        legalName: data.legalName,
        taxId: data.taxId,
        email: data.email,
        phone: data.phone,
        address: data.address,
        country: data.country,
        city: data.city,
        state: data.state,
        currencyCode: data.currencyCode,
        decimalPlaces: data.decimalPlaces,
        locale: data.locale,
        timezone: data.timezone,
        // Only overwritten when something new was captured, so opening the
        // form to fix a phone number does not wipe the logo or the location.
        ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}),
        ...(data.officeLatitude !== null
          ? { latitude: data.officeLatitude, longitude: data.officeLongitude }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        action: "company.updated",
        entityType: "Company",
        entityId: context.companyId,
        metadata: { currencyCode: data.currencyCode },
      },
    });
  });

  revalidatePath("/settings/company");
  revalidatePath("/", "layout");
  return { success: t("settings.saved") };
}
