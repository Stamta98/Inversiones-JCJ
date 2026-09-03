"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { GENDERS, isPlausibleBirthDate } from "@/core/customers/identity";
import { t } from "@/i18n";
import { normalizePhoneNumber } from "@/modules/messaging/providers";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import {
  moveCustomer,
  resetCustomerOrder,
} from "@/server/services/ordering";
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

/**
 * A date of birth, or nothing.
 *
 * Kept at midnight UTC like every other calendar day in the app, so the
 * birthday does not shift a day depending on where the server is.
 */
const optionalBirthDate = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value === undefined || value.length === 0
      ? null
      : new Date(`${value}T00:00:00.000Z`),
  )
  .refine((value) => value === null || isPlausibleBirthDate(value), {
    message: t("customers.errors.birthDate"),
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
  birthDate: optionalBirthDate,
  gender: z.enum(GENDERS).nullable().catch(null),
  nationality: optionalText,
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
    .enum([
      "DAILY",
      "WEEKLY",
      "BIWEEKLY",
      "SEMIMONTHLY",
      "MONTHLY",
      "IRREGULAR",
    ])
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
          birthDate: data.birthDate,
          gender: data.gender,
          nationality: data.nationality,
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
              {
                url: data.idFrontUrl,
                kind: "ID_FRONT" as const,
                name: "Documento (frente)",
              },
              {
                url: data.idBackUrl,
                kind: "ID_BACK" as const,
                name: "Documento (reverso)",
              },
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

const updateSchema = customerSchema.omit({ photoUrl: true }).extend({
  customerId: z.string().min(1),
  /** Vacío significa conservar la foto actual. */
  photoUrl: storedFileUrl.optional().default(""),
});

export async function updateCustomer(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const context = await requirePermission("customers.update");
  const parsed = updateSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    return { error: t("common.error"), fieldErrors };
  }

  const data = parsed.data;
  const references = readReferences(formData);

  const existing = await db.customer.findFirst({
    where: { id: data.customerId, companyId: context.companyId },
    select: { id: true },
  });
  if (!existing) return { error: t("common.error") };

  await db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: data.customerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        birthDate: data.birthDate,
        gender: data.gender,
        nationality: data.nationality,
        email: data.email,
        phone: data.phone,
        mobilePhone: data.mobilePhone
          ? (normalizePhoneNumber(data.mobilePhone, {
              defaultCountryCode: "1",
            }) ?? data.mobilePhone)
          : null,
        address: data.address,
        neighborhood: data.neighborhood,
        landmark: data.landmark,
        city: data.city,
        employmentType: data.employmentType,
        occupation: data.occupation,
        employerName: data.employerName,
        workAddress: data.workAddress,
        workNeighborhood: data.workNeighborhood,
        workLandmark: data.workLandmark,
        paydayKind: data.paydayKind,
        paydayWeekday: data.paydayWeekday,
        paydayDayOfMonth: data.paydayDayOfMonth,
        monthlyIncome: data.monthlyIncome,
        notes: data.notes,
        // Solo se pisan si el usuario capturó valores nuevos.
        ...(data.photoUrl ? { photoUrl: data.photoUrl } : {}),
        ...(data.homeLatitude !== null
          ? { latitude: data.homeLatitude, longitude: data.homeLongitude }
          : {}),
        ...(data.workLatitude !== null
          ? {
              workLatitude: data.workLatitude,
              workLongitude: data.workLongitude,
            }
          : {}),
      },
    });

    // Las fotos del documento se reemplazan solo si se subió una nueva: el
    // formulario reenvía la URL actual cuando no se tocaron.
    for (const document of [
      {
        kind: "ID_FRONT" as const,
        url: data.idFrontUrl,
        name: "Documento (frente)",
      },
      {
        kind: "ID_BACK" as const,
        url: data.idBackUrl,
        name: "Documento (reverso)",
      },
    ]) {
      if (document.url.length === 0) continue;

      const current = await tx.attachment.findFirst({
        where: { customerId: data.customerId, kind: document.kind },
      });
      if (current?.url === document.url) continue;

      if (current) {
        await tx.attachment.delete({ where: { id: current.id } });
      }
      await tx.attachment.create({
        data: {
          customerId: data.customerId,
          kind: document.kind,
          name: document.name,
          url: document.url,
          mimeType: "image/jpeg",
        },
      });
    }

    // Las referencias se reemplazan completas: es lo que el formulario envía.
    await tx.customerReference.deleteMany({
      where: { customerId: data.customerId },
    });
    if (references.length > 0) {
      await tx.customerReference.createMany({
        data: references.map((reference) => ({
          ...reference,
          customerId: data.customerId,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        action: "customer.updated",
        entityType: "Customer",
        entityId: data.customerId,
        metadata: {},
      },
    });
  });

  revalidatePath(`/customers/${data.customerId}`);
  revalidatePath("/customers");
  redirect(`/customers/${data.customerId}`);
}

/**
 * Mueve un cliente en la lista.
 *
 * Llega el vecino, no una posición: la lista puede venir filtrada o buscada, y
 * "ponlo antes de este" significa lo mismo en la lista completa que en la que
 * la persona está viendo.
 */
const moveSchema = z.object({
  id: z.string().min(1),
  targetId: z.string().optional(),
  placement: z.enum(["before", "after", "top"]),
});

export async function moveCustomerAction(formData: FormData): Promise<void> {
  const context = await requirePermission("customers.update");

  const parsed = moveSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );
  // Una página vieja pide un movimiento imposible: no es un error que merezca
  // pantalla, solo no se hace nada.
  if (!parsed.success) return;

  await moveCustomer({
    companyId: context.companyId,
    id: parsed.data.id,
    targetId: parsed.data.targetId || null,
    placement: parsed.data.placement,
  });

  revalidatePath("/customers");
}

export async function resetCustomerOrderAction(): Promise<void> {
  const context = await requirePermission("customers.update");
  await resetCustomerOrder(context.companyId);
  revalidatePath("/customers");
}
