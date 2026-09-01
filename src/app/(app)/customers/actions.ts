"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { t } from "@/i18n";
import { normalizePhoneNumber } from "@/modules/messaging/providers";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { nextCustomerCode, withCodeRetry } from "@/server/services/sequences";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

const customerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  documentType: optionalText,
  documentNumber: optionalText,
  email: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine(
      (value) => value === null || z.string().email().safeParse(value).success,
      { message: t("validation.email") },
    ),
  phone: optionalText,
  mobilePhone: optionalText,
  address: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  employmentType: z
    .enum(["INDEPENDENT", "EMPLOYEE", "OTHER"])
    .nullable()
    .catch(null),
  occupation: optionalText,
  employerName: optionalText,
  workAddress: optionalText,
  workNeighborhood: optionalText,
  monthlyIncome: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : Number(value)))
    .nullable(),
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
    return {
      error: t("common.error"),
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      ),
    };
  }

  const data = parsed.data;
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
          city: data.city,
          employmentType: data.employmentType,
          occupation: data.occupation,
          employerName: data.employerName,
          workAddress: data.workAddress,
          workNeighborhood: data.workNeighborhood,
          monthlyIncome: data.monthlyIncome,
          notes: data.notes,
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
