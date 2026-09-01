"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { normalizePhoneNumber } from "@/modules/messaging/providers";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { nextCustomerCode, withCodeRetry } from "@/server/services/sequences";

/**
 * An optional text field.
 *
 * It must tolerate the key being absent, not just empty: fields that only
 * render under a condition (the employer name, shown only for an employee)
 * never reach FormData when that condition is false.
 */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value === undefined || value.length === 0 ? null : value,
  );

/** Only paths this app itself serves; never an arbitrary external URL. */
const storedFileUrl = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || value.startsWith("/api/files/"), {
    message: "Archivo inválido",
  });

/** A coordinate that the browser may not have been able to capture. */
const optionalCoordinate = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined || value.length === 0) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

const optionalWholeNumber = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined || value.length === 0) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  });

/**
 * Reference rows arrive as parallel repeated fields, one per column. Rows
 * with no name at all are the empty slots the form always renders, and are
 * dropped rather than saved blank.
 */
function readReferences(formData: FormData): Array<{
  fullName: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
}> {
  const names = formData.getAll("referenceName").map(String);
  const relationships = formData.getAll("referenceRelationship").map(String);
  const phones = formData.getAll("referencePhone").map(String);
  const addresses = formData.getAll("referenceAddress").map(String);

  const clean = (value: string | undefined) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  return names
    .map((name, index) => {
      const phone = clean(phones[index]);
      return {
        fullName: name.trim(),
        relationship: clean(relationships[index]),
        // Same E.164 normalization as the customer's own number, so a
        // reference can be called or messaged without re-parsing it.
        phone: phone
          ? (normalizePhoneNumber(phone, { defaultCountryCode: "1" }) ?? phone)
          : null,
        address: clean(addresses[index]),
      };
    })
    .filter((reference) => reference.fullName.length > 0);
}

const customerSchema = z.object({
  photoUrl: storedFileUrl.refine((value) => value.length > 0, {
    message: t("customers.photoRequired"),
  }),
  idFrontUrl: storedFileUrl.optional().default(""),
  idBackUrl: storedFileUrl.optional().default(""),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  documentType: optionalText,
  documentNumber: optionalText,
  email: optionalText.refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: t("validation.email") },
  ),
  phone: optionalText,
  mobilePhone: optionalText,
  address: optionalText,
  neighborhood: optionalText,
  landmark: optionalText,
  city: optionalText,
  homeLatitude: optionalCoordinate,
  homeLongitude: optionalCoordinate,
  employmentType: z
    .enum(["INDEPENDENT", "EMPLOYEE", "OTHER"])
    .nullable()
    .catch(null),
  occupation: optionalText,
  employerName: optionalText,
  workAddress: optionalText,
  workNeighborhood: optionalText,
  workLandmark: optionalText,
  workLatitude: optionalCoordinate,
  workLongitude: optionalCoordinate,
  paydayKind: z
    .enum(["DAILY", "WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "IRREGULAR"])
    .nullable()
    .catch(null),
  paydayWeekday: optionalWholeNumber,
  paydayDayOfMonth: optionalWholeNumber,
  monthlyIncome: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value === undefined || value.length === 0 ? null : Number(value),
    ),
  notes: optionalText,
});

export interface CustomerFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function readForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

export async function createCustomer(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const context = await requirePermission("customers.create");
  const parsed = customerSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    return {
      error: fieldErrors.photoUrl ?? t("common.error"),
      fieldErrors,
    };
  }

  const data = parsed.data;
  const references = readReferences(formData);
  const customerId = await withCodeRetry(() =>
    db.$transaction(async (tx) => {
      const code = await nextCustomerCode(tx, context.companyId);
      const customer = await tx.customer.create({
        data: {
          companyId: context.companyId,
          branchId: context.branchId,
          code,
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          email: data.email,
          phone: data.phone,
          // Stored in E.164 so WhatsApp can use it without re-parsing.
          mobilePhone: data.mobilePhone
            ? (normalizePhoneNumber(data.mobilePhone, {
                defaultCountryCode: "1",
              }) ?? data.mobilePhone)
            : null,
          address: data.address,
          neighborhood: data.neighborhood,
          landmark: data.landmark,
          city: data.city,
          latitude: data.homeLatitude,
          longitude: data.homeLongitude,
          employmentType: data.employmentType,
          occupation: data.occupation,
          employerName: data.employerName,
          workAddress: data.workAddress,
          workNeighborhood: data.workNeighborhood,
          workLandmark: data.workLandmark,
          workLatitude: data.workLatitude,
          workLongitude: data.workLongitude,
          paydayKind: data.paydayKind,
          paydayWeekday: data.paydayWeekday,
          paydayDayOfMonth: data.paydayDayOfMonth,
          monthlyIncome: data.monthlyIncome,
          notes: data.notes,
          photoUrl: data.photoUrl,
          references: { create: references },
          attachments: {
            create: [
              { url: data.idFrontUrl, kind: "ID_FRONT" as const, name: "Documento (frente)" },
              { url: data.idBackUrl, kind: "ID_BACK" as const, name: "Documento (reverso)" },
            ]
              .filter((attachment) => attachment.url.length > 0)
              .map((attachment) => ({
                kind: attachment.kind,
                name: attachment.name,
                url: attachment.url,
                mimeType: "image/jpeg",
              })),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          action: "customer.created",
          entityType: "Customer",
          entityId: customer.id,
          metadata: { code },
        },
      });

      return customer.id;
    }),
  );

  revalidatePath("/customers");
  redirect(`/customers/${customerId}`);
}
