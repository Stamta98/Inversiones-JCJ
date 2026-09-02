/**
 * Collection route service.
 *
 * Building the day's route, recording what happened at each door, and taking
 * the money. Collecting goes through the payment service, so a peso collected
 * on the street lands in the cash box, on the loan and on a receipt exactly
 * like one paid at the office.
 */

import {
  moveStop,
  resequence,
  type StopStatus,
} from "@/core/collections/route";
import { startOfDay } from "@/core/dates";

import type { Prisma } from "@prisma/client";

import { db } from "../db";
import { PaymentError, postPayment, type PaymentMethod } from "./payments";

export class CollectionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "noStops"
      | "notFound"
      | "routeClosed"
      | "alreadyOnRoute"
      | "amount"
      | "loanNotActive"
      | "nothingToApply",
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

/** How a route decides which loans to knock on. */
export type RouteSource = "due" | "arrears" | "all";

const MAX_STOPS = 200;

export interface BuildRouteInput {
  companyId: string;
  branchId?: string | null;
  name: string;
  scheduledFor?: Date | null;
  collectorId?: string | null;
  source: RouteSource;
  createdById?: string | null;
}

/**
 * Creates a route and fills it with stops in one go.
 *
 * A route with no stops is useless to a collector heading out, so an empty
 * result is an error rather than an empty route to puzzle over.
 */
export async function buildRoute(input: BuildRouteInput): Promise<string> {
  const scheduledFor = startOfDay(input.scheduledFor ?? new Date());
  const dayEnd = new Date(scheduledFor.getTime() + 24 * 60 * 60 * 1000);

  // A loan already being visited that day does not belong on a second route:
  // two collectors knocking on the same door is how a customer pays twice.
  const alreadyRouted = await db.routeStop.findMany({
    where: {
      route: {
        companyId: input.companyId,
        scheduledFor: { gte: scheduledFor, lt: dayEnd },
      },
      loanId: { not: null },
    },
    select: { loanId: true },
  });
  const busyLoanIds = alreadyRouted
    .map((stop) => stop.loanId)
    .filter((id): id is string => id !== null);

  const openInstallments = {
    status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
  } satisfies Prisma.LoanInstallmentWhereInput;

  const loans = await db.loan.findMany({
    where: {
      companyId: input.companyId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      id: busyLoanIds.length > 0 ? { notIn: busyLoanIds } : undefined,
      ...(input.source === "arrears"
        ? { status: "IN_ARREARS" }
        : {
            status: { in: ["ACTIVE", "IN_ARREARS"] },
            ...(input.source === "due"
              ? {
                  installments: {
                    some: {
                      dueDate: { gte: scheduledFor, lt: dayEnd },
                      ...openInstallments,
                    },
                  },
                }
              : { installments: { some: openInstallments } }),
          }),
    },
    include: {
      installments: {
        where: openInstallments,
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    // Worst arrears first: the doors most worth knocking on come first.
    orderBy: [{ daysInArrears: "desc" }, { code: "asc" }],
    take: MAX_STOPS,
  });

  if (loans.length === 0) {
    throw new CollectionError("Nothing to collect", "noStops");
  }

  const route = await db.$transaction(async (tx) => {
    const created = await tx.collectionRoute.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        name: input.name.trim(),
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
              collectorId: input.collectorId || null,
              sortOrder: index,
              expectedAmount: expected > 0 ? expected : 0,
            };
          }),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.createdById ?? null,
        action: "route.created",
        entityType: "CollectionRoute",
        entityId: created.id,
        metadata: { stops: loans.length, source: input.source },
      },
    });

    return created;
  });

  return route.id;
}

/** Loads a route for writing, refusing one that belongs to another company. */
async function openRouteOrThrow(companyId: string, routeId: string) {
  const route = await db.collectionRoute.findFirst({
    where: { id: routeId, companyId },
    select: { id: true, closedAt: true },
  });
  if (!route) throw new CollectionError("Route not found", "notFound");
  if (route.closedAt) throw new CollectionError("Route closed", "routeClosed");
  return route;
}

/** Same, for a stop: the company check happens through its route. */
async function openStopOrThrow(companyId: string, stopId: string) {
  const stop = await db.routeStop.findFirst({
    where: { id: stopId, route: { companyId } },
    include: { route: { select: { id: true, closedAt: true } } },
  });
  if (!stop) throw new CollectionError("Stop not found", "notFound");
  if (stop.route.closedAt) {
    throw new CollectionError("Route closed", "routeClosed");
  }
  return stop;
}

export interface RecordVisitInput {
  companyId: string;
  stopId: string;
  status: StopStatus;
  promisedFor?: Date | null;
  notes?: string | null;
  userId?: string | null;
}

/** Records what happened at a door, without money changing hands. */
export async function recordVisit(input: RecordVisitInput): Promise<void> {
  const stop = await openStopOrThrow(input.companyId, input.stopId);

  await db.routeStop.update({
    where: { id: stop.id },
    data: {
      status: input.status,
      // Going back to pending undoes the visit, date included.
      visitedAt: input.status === "PENDING" ? null : new Date(),
      promisedFor:
        input.status === "PROMISED" ? (input.promisedFor ?? null) : null,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}

export interface CollectAtStopInput {
  companyId: string;
  stopId: string;
  amount: number;
  method?: PaymentMethod;
  cashBoxId?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  userId?: string | null;
}

export interface CollectAtStopResult {
  receiptNumber: string;
  appliedAmount: number;
  unappliedAmount: number;
}

/**
 * Takes money at a stop: posts a real payment and records it on the visit.
 */
export async function collectAtStop(
  input: CollectAtStopInput,
): Promise<CollectAtStopResult> {
  const stop = await openStopOrThrow(input.companyId, input.stopId);
  if (!stop.loanId) {
    throw new CollectionError("Stop has no loan", "notFound");
  }

  let payment;
  try {
    payment = await postPayment({
      companyId: input.companyId,
      loanId: stop.loanId,
      amount: input.amount,
      method: input.method ?? "CASH",
      cashBoxId: input.cashBoxId ?? null,
      notes: input.notes ?? null,
      collectedById: input.userId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });
  } catch (error) {
    // The payment service already knows why an amount cannot be taken; the
    // route screen only needs the same reason back in its own vocabulary.
    if (error instanceof PaymentError) {
      throw new CollectionError(error.message, error.code);
    }
    throw error;
  }

  await db.routeStop.update({
    where: { id: stop.id },
    data: {
      status: "COLLECTED",
      visitedAt: new Date(),
      promisedFor: null,
      // A second visit to the same door adds to what was already taken.
      collectedAmount: Number(stop.collectedAmount) + input.amount,
      paymentId: payment.paymentId,
      ...(input.notes ? { notes: input.notes } : {}),
    },
  });

  return {
    receiptNumber: payment.receiptNumber,
    appliedAmount: payment.appliedAmount,
    unappliedAmount: payment.unappliedAmount,
  };
}

export async function reorderStop(input: {
  companyId: string;
  stopId: string;
  direction: "up" | "down";
}): Promise<void> {
  const stop = await openStopOrThrow(input.companyId, input.stopId);

  const siblings = await db.routeStop.findMany({
    where: { routeId: stop.routeId },
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const moves = moveStop(siblings, stop.id, input.direction);
  if (moves.length === 0) return;

  await db.$transaction(
    moves.map((move) =>
      db.routeStop.update({
        where: { id: move.id },
        data: { sortOrder: move.sortOrder },
      }),
    ),
  );
}

export async function removeStop(input: {
  companyId: string;
  stopId: string;
}): Promise<void> {
  const stop = await openStopOrThrow(input.companyId, input.stopId);
  const routeId = stop.routeId;

  await db.$transaction(async (tx) => {
    await tx.routeStop.delete({ where: { id: stop.id } });

    const remaining = await tx.routeStop.findMany({
      where: { routeId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const move of resequence(remaining)) {
      await tx.routeStop.update({
        where: { id: move.id },
        data: { sortOrder: move.sortOrder },
      });
    }
  });
}

export async function addStop(input: {
  companyId: string;
  routeId: string;
  loanId: string;
}): Promise<void> {
  const route = await openRouteOrThrow(input.companyId, input.routeId);

  const loan = await db.loan.findFirst({
    where: { id: input.loanId, companyId: input.companyId },
    include: {
      installments: {
        where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
  });
  if (!loan) throw new CollectionError("Loan not found", "notFound");

  const duplicate = await db.routeStop.findFirst({
    where: { routeId: route.id, loanId: loan.id },
    select: { id: true },
  });
  if (duplicate) {
    throw new CollectionError("Already on this route", "alreadyOnRoute");
  }

  const last = await db.routeStop.findFirst({
    where: { routeId: route.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true, collectorId: true },
  });

  const installment = loan.installments[0];
  const expected = installment
    ? Number(installment.totalAmount) - Number(installment.paidAmount)
    : 0;

  await db.routeStop.create({
    data: {
      routeId: route.id,
      customerId: loan.customerId,
      loanId: loan.id,
      // A visit added by hand belongs to whoever is walking the route.
      collectorId: last?.collectorId ?? null,
      sortOrder: last ? last.sortOrder + 1 : 0,
      expectedAmount: expected > 0 ? expected : 0,
    },
  });
}

/** Points every stop of a route at one collector. */
export async function assignRoute(input: {
  companyId: string;
  routeId: string;
  collectorId: string | null;
}): Promise<void> {
  const route = await openRouteOrThrow(input.companyId, input.routeId);

  if (input.collectorId) {
    const membership = await db.membership.findFirst({
      where: {
        userId: input.collectorId,
        companyId: input.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!membership) throw new CollectionError("User not found", "notFound");
  }

  await db.routeStop.updateMany({
    where: { routeId: route.id },
    data: { collectorId: input.collectorId },
  });
}

export async function closeRoute(input: {
  companyId: string;
  routeId: string;
  userId?: string | null;
}): Promise<void> {
  const route = await openRouteOrThrow(input.companyId, input.routeId);

  await db.$transaction(async (tx) => {
    await tx.collectionRoute.update({
      where: { id: route.id },
      data: { closedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        action: "route.closed",
        entityType: "CollectionRoute",
        entityId: route.id,
        metadata: {},
      },
    });
  });
}

/** Reopening is for the mistake of closing early, not for editing history. */
export async function reopenRoute(input: {
  companyId: string;
  routeId: string;
  userId?: string | null;
}): Promise<void> {
  const route = await db.collectionRoute.findFirst({
    where: { id: input.routeId, companyId: input.companyId },
    select: { id: true },
  });
  if (!route) throw new CollectionError("Route not found", "notFound");

  await db.collectionRoute.update({
    where: { id: route.id },
    data: { closedAt: null },
  });
}

export async function deleteRoute(input: {
  companyId: string;
  routeId: string;
  userId?: string | null;
}): Promise<void> {
  const route = await db.collectionRoute.findFirst({
    where: { id: input.routeId, companyId: input.companyId },
    select: { id: true },
  });
  if (!route) throw new CollectionError("Route not found", "notFound");

  // Deleting the plan never deletes the money: payments live on the loan and
  // in the cash box, and only lose their link back to the visit.
  await db.$transaction(async (tx) => {
    await tx.collectionRoute.delete({ where: { id: route.id } });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        action: "route.deleted",
        entityType: "CollectionRoute",
        entityId: route.id,
        metadata: {},
      },
    });
  });
}
