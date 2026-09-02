"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { STOP_STATUSES } from "@/core/collections/route";
import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import {
  CollectionError,
  addStop,
  assignRoute,
  buildRoute,
  closeRoute,
  collectAtStop,
  deleteRoute,
  recordVisit,
  removeStop,
  reopenRoute,
  reorderStop,
} from "@/server/services/collections";
import type { PaymentMethod } from "@/server/services/payments";

export interface RouteFormState {
  error?: string;
  success?: string;
}

/** Every collection failure already carries its reason; this names it. */
function messageFor(error: unknown): string {
  if (error instanceof CollectionError) {
    const message = t(`collections.errors.${error.code}`);
    return message === `collections.errors.${error.code}`
      ? t("common.error")
      : message;
  }
  throw error;
}

function readForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

/** A date input gives a calendar day; noon keeps it on that day everywhere. */
function parseDay(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const routeSchema = z.object({
  name: z.string().trim().min(1),
  scheduledFor: z.string().optional(),
  collectorId: z.string().optional(),
  /** What fills the route: today's installments, debtors, or every open loan. */
  source: z.enum(["due", "arrears", "all"]).default("due"),
});

export async function createRoute(
  _previous: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const context = await requirePermission("collections.create");
  const parsed = routeSchema.safeParse(readForm(formData));

  if (!parsed.success) return { error: t("collections.errors.nameRequired") };

  let routeId: string;
  try {
    routeId = await buildRoute({
      companyId: context.companyId,
      branchId: context.branchId,
      name: parsed.data.name,
      scheduledFor: parseDay(parsed.data.scheduledFor),
      collectorId: parsed.data.collectorId || null,
      source: parsed.data.source,
      createdById: context.userId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/collections");
  redirect(`/collections/${routeId}`);
}

const visitSchema = z.object({
  stopId: z.string().min(1),
  status: z.enum(STOP_STATUSES),
  promisedFor: z.string().optional(),
  notes: z.string().optional(),
});

export async function recordVisitAction(
  _previous: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const context = await requirePermission("collections.update");
  const parsed = visitSchema.safeParse(readForm(formData));

  if (!parsed.success) return { error: t("common.error") };

  try {
    await recordVisit({
      companyId: context.companyId,
      stopId: parsed.data.stopId,
      status: parsed.data.status,
      promisedFor: parseDay(parsed.data.promisedFor),
      notes: parsed.data.notes ?? null,
      userId: context.userId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/collections");
  return { success: t("collections.visitSaved") };
}

const collectSchema = z.object({
  stopId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z
    .enum(["CASH", "BANK_TRANSFER", "CARD", "CHECK", "MOBILE_WALLET", "OTHER"])
    .default("CASH"),
  cashBoxId: z.string().optional(),
  notes: z.string().optional(),
});

export async function collectAtStopAction(
  _previous: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const context = await requirePermission("payments.create");
  const parsed = collectSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return { error: t("collections.errors.amount") };
  }

  let result;
  try {
    result = await collectAtStop({
      companyId: context.companyId,
      stopId: parsed.data.stopId,
      amount: parsed.data.amount,
      method: parsed.data.method as PaymentMethod,
      cashBoxId: parsed.data.cashBoxId || null,
      notes: parsed.data.notes || null,
      userId: context.userId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/collections");
  revalidatePath("/payments");

  const collected = t("collections.collectedReceipt").replace(
    "{receipt}",
    result.receiptNumber,
  );

  // Money that did not fit on any open installment is the one thing a
  // collector must be told about before they walk away.
  return {
    success:
      result.unappliedAmount > 0
        ? `${collected} · ${t("payments.unapplied")}: ${context.money(result.unappliedAmount)}`
        : collected,
  };
}

const stopIdSchema = z.object({ stopId: z.string().min(1) });

export async function moveStopUpAction(formData: FormData): Promise<void> {
  await moveStopAction(formData, "up");
}

export async function moveStopDownAction(formData: FormData): Promise<void> {
  await moveStopAction(formData, "down");
}

async function moveStopAction(
  formData: FormData,
  direction: "up" | "down",
): Promise<void> {
  const context = await requirePermission("collections.update");
  const parsed = stopIdSchema.safeParse(readForm(formData));
  if (!parsed.success) return;

  try {
    await reorderStop({
      companyId: context.companyId,
      stopId: parsed.data.stopId,
      direction,
    });
  } catch (error) {
    // Reordering a stop on a closed route is a stale page, not a failure
    // worth an error screen.
    if (!(error instanceof CollectionError)) throw error;
  }

  revalidatePath("/collections");
}

export async function removeStopAction(formData: FormData): Promise<void> {
  const context = await requirePermission("collections.update");
  const parsed = stopIdSchema.safeParse(readForm(formData));
  if (!parsed.success) return;

  try {
    await removeStop({
      companyId: context.companyId,
      stopId: parsed.data.stopId,
    });
  } catch (error) {
    if (!(error instanceof CollectionError)) throw error;
  }

  revalidatePath("/collections");
}

const addStopSchema = z.object({
  routeId: z.string().min(1),
  loanId: z.string().min(1),
});

export async function addStopAction(
  _previous: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const context = await requirePermission("collections.update");
  const parsed = addStopSchema.safeParse(readForm(formData));

  if (!parsed.success) return { error: t("common.error") };

  try {
    await addStop({
      companyId: context.companyId,
      routeId: parsed.data.routeId,
      loanId: parsed.data.loanId,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/collections");
  return { success: t("collections.stopAdded") };
}

const assignSchema = z.object({
  routeId: z.string().min(1),
  collectorId: z.string().optional(),
});

export async function assignRouteAction(
  _previous: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const context = await requirePermission("collections.update");
  const parsed = assignSchema.safeParse(readForm(formData));

  if (!parsed.success) return { error: t("common.error") };

  try {
    await assignRoute({
      companyId: context.companyId,
      routeId: parsed.data.routeId,
      collectorId: parsed.data.collectorId || null,
    });
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/collections");
  return { success: t("collections.assigned") };
}

const routeIdSchema = z.object({ routeId: z.string().min(1) });

export async function closeRouteAction(formData: FormData): Promise<void> {
  const context = await requirePermission("collections.update");
  const parsed = routeIdSchema.safeParse(readForm(formData));
  if (!parsed.success) return;

  try {
    await closeRoute({
      companyId: context.companyId,
      routeId: parsed.data.routeId,
      userId: context.userId,
    });
  } catch (error) {
    if (!(error instanceof CollectionError)) throw error;
  }

  revalidatePath("/collections");
}

export async function reopenRouteAction(formData: FormData): Promise<void> {
  const context = await requirePermission("collections.update");
  const parsed = routeIdSchema.safeParse(readForm(formData));
  if (!parsed.success) return;

  try {
    await reopenRoute({
      companyId: context.companyId,
      routeId: parsed.data.routeId,
      userId: context.userId,
    });
  } catch (error) {
    if (!(error instanceof CollectionError)) throw error;
  }

  revalidatePath("/collections");
}

export async function deleteRouteAction(formData: FormData): Promise<void> {
  const context = await requirePermission("collections.delete");
  const parsed = routeIdSchema.safeParse(readForm(formData));
  if (!parsed.success) return;

  try {
    await deleteRoute({
      companyId: context.companyId,
      routeId: parsed.data.routeId,
      userId: context.userId,
    });
  } catch (error) {
    if (!(error instanceof CollectionError)) throw error;
  }

  revalidatePath("/collections");
  redirect("/collections");
}
