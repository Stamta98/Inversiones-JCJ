/**
 * Payment promise service.
 *
 * Promises are made in two places — at the door on a route, and on a call —
 * and both write here, so there is one list to work from instead of two places
 * to remember to look.
 */

import {
  evaluatePromise,
  type PromiseSource,
} from "@/core/collections/promise";
import { startOfDay } from "@/core/dates";
import { toCents } from "@/core/money";

import type { Prisma } from "@prisma/client";

import { db } from "../db";

export interface RecordPromiseInput {
  companyId: string;
  customerId: string;
  loanId?: string | null;
  amount: number;
  promisedFor: Date;
  source: PromiseSource;
  routeStopId?: string | null;
  interactionId?: string | null;
  notes?: string | null;
  createdById?: string | null;
}

/**
 * Records what the customer said.
 *
 * Saying it again on the same doorstep replaces the previous promise rather
 * than stacking a second one on top: a customer who moves the date has one
 * promise on a new day, not two they are both failing.
 */
export async function recordPromise(
  input: RecordPromiseInput,
): Promise<string> {
  const promisedFor = startOfDay(input.promisedFor);

  const data = {
    companyId: input.companyId,
    customerId: input.customerId,
    loanId: input.loanId ?? null,
    amount: input.amount,
    promisedFor,
    source: input.source,
    notes: input.notes ?? null,
    createdById: input.createdById ?? null,
    status: "PENDING" as const,
    paidAmount: 0,
    resolvedAt: null,
  };

  if (input.routeStopId) {
    const promise = await db.paymentPromise.upsert({
      where: { routeStopId: input.routeStopId },
      create: { ...data, routeStopId: input.routeStopId },
      update: data,
    });
    return promise.id;
  }

  if (input.interactionId) {
    const promise = await db.paymentPromise.upsert({
      where: { interactionId: input.interactionId },
      create: { ...data, interactionId: input.interactionId },
      update: data,
    });
    return promise.id;
  }

  const promise = await db.paymentPromise.create({ data });
  return promise.id;
}

/** Withdraws a promise without counting it against the customer. */
export async function cancelPromise(input: {
  companyId: string;
  promiseId: string;
}): Promise<void> {
  const promise = await db.paymentPromise.findFirst({
    where: { id: input.promiseId, companyId: input.companyId },
    select: { id: true },
  });
  if (!promise) return;

  await db.paymentPromise.update({
    where: { id: promise.id },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
}

/**
 * Re-checks the open promises of one customer against what they have paid.
 *
 * Called when a payment posts, so the list is honest the moment the money
 * arrives rather than the next morning.
 */
export async function refreshPromisesForCustomer(
  companyId: string,
  customerId: string,
  today: Date = new Date(),
): Promise<void> {
  const open = await db.paymentPromise.findMany({
    where: { companyId, customerId, status: "PENDING" },
  });
  if (open.length === 0) return;

  for (const promise of open) {
    // Only money that arrived after the promise was made can keep it.
    const payments = await db.payment.aggregate({
      where: {
        companyId,
        status: "POSTED",
        paidAt: { gte: promise.createdAt },
        ...(promise.loanId
          ? { loanId: promise.loanId }
          : { loan: { customerId } }),
      },
      _sum: { amount: true },
    });

    const paid = Number(payments._sum.amount ?? 0);
    const verdict = evaluatePromise({
      promisedCents: toCents(Number(promise.amount)),
      paidCents: toCents(paid),
      promisedFor: promise.promisedFor,
      today,
    });

    if (verdict.status === "PENDING" && paid === Number(promise.paidAmount)) {
      continue;
    }

    await db.paymentPromise.update({
      where: { id: promise.id },
      data: {
        paidAmount: paid,
        status: verdict.status,
        resolvedAt: verdict.status === "PENDING" ? null : new Date(),
      },
    });
  }
}

/**
 * Sweeps every company's open promises, for the daily job: a promise nobody
 * paid has to become broken on its own, without waiting for a payment that is
 * never coming.
 */
export async function refreshOverduePromises(
  companyId: string,
  today: Date = new Date(),
): Promise<number> {
  const overdue = await db.paymentPromise.findMany({
    where: {
      companyId,
      status: "PENDING",
      promisedFor: { lt: startOfDay(today) },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  for (const promise of overdue) {
    await refreshPromisesForCustomer(companyId, promise.customerId, today);
  }

  return overdue.length;
}

/** Open promises, worst first: overdue before today before the rest. */
export function openPromiseOrder(): Prisma.PaymentPromiseOrderByWithRelationInput[] {
  return [{ promisedFor: "asc" }, { amount: "desc" }];
}
