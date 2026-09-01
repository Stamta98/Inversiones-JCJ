"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { startOfDay } from "@/core/dates";
import { t } from "@/i18n";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

const routeSchema = z.object({
  name: z.string().trim().min(1),
  scheduledFor: z.string().optional(),
  collectorId: z.string().optional(),
  /** "due" fills the route with what is due that day, "arrears" with debtors. */
  source: z.enum(["due", "arrears"]).default("due"),
});

export interface RouteFormState {
  error?: string;
}

/**
 * Creates a route and fills it with stops in one go, because a route with no
 * stops is useless to a collector heading out.
 */
export async function createRoute(
  _previous: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const context = await requirePermission("collections.create");
  const parsed = routeSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    ),
  );

  if (!parsed.success) return { error: t("common.error") };

  const data = parsed.data;
  const scheduledFor = data.scheduledFor
    ? startOfDay(new Date(`${data.scheduledFor}T00:00:00.000Z`))
    : startOfDay(new Date());
  const dayEnd = new Date(scheduledFor.getTime() + 24 * 60 * 60 * 1000);

  const loans = await db.loan.findMany({
    where:
      data.source === "arrears"
        ? { companyId: context.companyId, status: "IN_ARREARS" }
        : {
            companyId: context.companyId,
            status: { in: ["ACTIVE", "IN_ARREARS"] },
            installments: {
              some: {
                dueDate: { gte: scheduledFor, lt: dayEnd },
                status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
              },
            },
          },
    include: {
      customer: { select: { id: true } },
      installments: {
        where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { daysInArrears: "desc" },
    take: 100,
  });

  await db.collectionRoute.create({
    data: {
      companyId: context.companyId,
      branchId: context.branchId,
      name: data.name,
      scheduledFor,
      stops: {
        create: loans.map((loan, index) => {
          const installment = loan.installments[0];
          const expected = installment
            ? Number(installment.totalAmount) - Number(installment.paidAmount)
            : 0;

          return {
            customerId: loan.customerId,
            loanId: loan.id,
            collectorId: data.collectorId || null,
            sortOrder: index,
            expectedAmount: expected > 0 ? expected : 0,
          };
        }),
      },
    },
  });

  revalidatePath("/collections");
  return {};
}

const stopSchema = z.object({
  stopId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "VISITED",
    "COLLECTED",
    "NOT_FOUND",
    "PROMISED",
    "REFUSED",
  ]),
});

export async function updateStopStatus(formData: FormData): Promise<void> {
  const context = await requirePermission("collections.update");
  const parsed = stopSchema.safeParse({
    stopId: String(formData.get("stopId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  if (!parsed.success) return;

  const stop = await db.routeStop.findFirst({
    where: {
      id: parsed.data.stopId,
      route: { companyId: context.companyId },
    },
  });
  if (!stop) return;

  await db.routeStop.update({
    where: { id: stop.id },
    data: {
      status: parsed.data.status,
      visitedAt: parsed.data.status === "PENDING" ? null : new Date(),
    },
  });

  revalidatePath("/collections");
}
