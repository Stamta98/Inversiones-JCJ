"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { NOTICE_DAYS_REQUIRED, CREDIT_SEVERITIES } from "@/core/credit/report";
import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import {
  CreditReportError,
  reportCustomer,
  withdrawReport,
} from "@/server/services/credit";

export interface CreditFormState {
  error?: string;
  success?: string;
}

/** Traduce el motivo del servicio, poniéndole los días donde hagan falta. */
function message(error: CreditReportError): string {
  return t(`credit.errors.${error.code}`).replace(
    "{days}",
    String(NOTICE_DAYS_REQUIRED),
  );
}

const reportSchema = z.object({
  customerId: z.string().min(1),
  loanId: z.string().optional(),
  severity: z.enum(CREDIT_SEVERITIES),
  amount: z.coerce.number().min(0),
  reason: z.string().optional(),
  // La fecha del aviso: sin ella el servicio no deja reportar.
  noticedAt: z.string().optional(),
});

export async function reportCustomerAction(
  _previous: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  const context = await requirePermission("credit.create");

  const parsed = reportSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );
  if (!parsed.success) {
    return { error: t("credit.errors.document") };
  }

  const data = parsed.data;

  let reported: { id: string; name: string };
  try {
    reported = await reportCustomer({
      companyId: context.companyId,
      userId: context.userId,
      customerId: data.customerId,
      loanId: data.loanId || null,
      severity: data.severity,
      amount: data.amount,
      reason: data.reason ?? null,
      // Mediodía en punto, como el resto de las fechas escritas a mano: así no
      // se corre de día por la hora.
      noticedAt: data.noticedAt
        ? new Date(`${data.noticedAt}T12:00:00.000Z`)
        : null,
    });
  } catch (error) {
    if (error instanceof CreditReportError) return { error: message(error) };
    throw error;
  }

  revalidatePath("/credit");
  revalidatePath(`/customers/${data.customerId}`);
  if (data.loanId) revalidatePath(`/loans/${data.loanId}`);

  return { success: t("credit.reported").replace("{name}", reported.name) };
}

const withdrawSchema = z.object({
  reportId: z.string().min(1),
  reason: z.string().min(1),
});

export async function withdrawReportAction(
  _previous: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  const context = await requirePermission("credit.update");

  const parsed = withdrawSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );
  if (!parsed.success) {
    return { error: t("credit.errors.withdrawReason") };
  }

  try {
    await withdrawReport({
      companyId: context.companyId,
      userId: context.userId,
      reportId: parsed.data.reportId,
      reason: parsed.data.reason,
    });
  } catch (error) {
    if (error instanceof CreditReportError) return { error: message(error) };
    throw error;
  }

  revalidatePath("/credit");
  return { success: t("credit.withdrawn") };
}
