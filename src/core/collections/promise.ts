/**
 * Payment promises.
 *
 * Someone who already said "te pago el viernes" is the cheapest collection
 * there is: no persuading left to do, only a reminder. What turns that into
 * money is deciding, without argument, whether the promise was kept — and
 * counting the ones that were not, because a customer on their third broken
 * promise is telling you something the loan file does not.
 */

import type { Cents } from "../money";

export const PROMISE_STATUSES = [
  "PENDING",
  "KEPT",
  "BROKEN",
  "CANCELLED",
] as const;

export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

export const PROMISE_SOURCES = ["ROUTE", "CALL", "MANUAL"] as const;

export type PromiseSource = (typeof PROMISE_SOURCES)[number];

/** Midnight UTC, the same calendar day every date in this app is measured in. */
function day(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export interface PromiseEvaluation {
  status: PromiseStatus;
  /** Still owed on the promise, never negative. */
  remainingCents: Cents;
  /** Negative once the promised day has passed. */
  daysLeft: number;
}

/**
 * Decides where a promise stands today.
 *
 * Paying the full amount keeps it, whenever it lands. Anything less is still
 * open until the promised day is behind us, and then it is broken — a part
 * payment is not a kept promise, and calling it one would quietly excuse the
 * customers who never quite finish.
 */
export function evaluatePromise(input: {
  promisedCents: Cents;
  paidCents: Cents;
  promisedFor: Date;
  today?: Date;
}): PromiseEvaluation {
  const today = input.today ?? new Date();
  const daysLeft = Math.round(
    (day(input.promisedFor) - day(today)) / 86_400_000,
  );
  const remainingCents = Math.max(0, input.promisedCents - input.paidCents);

  if (input.paidCents >= input.promisedCents) {
    return { status: "KEPT", remainingCents: 0, daysLeft };
  }

  return {
    status: daysLeft < 0 ? "BROKEN" : "PENDING",
    remainingCents,
    daysLeft,
  };
}

/** Which pile a promise belongs in on the screen. */
export type PromiseBucket = "overdue" | "today" | "upcoming" | "closed";

export function bucketOf(
  status: PromiseStatus,
  promisedFor: Date,
  today: Date = new Date(),
): PromiseBucket {
  if (status === "KEPT" || status === "CANCELLED") return "closed";
  if (status === "BROKEN") return "overdue";

  const daysLeft = Math.round((day(promisedFor) - day(today)) / 86_400_000);
  if (daysLeft < 0) return "overdue";
  return daysLeft === 0 ? "today" : "upcoming";
}

export interface PromiseRecord {
  total: number;
  kept: number;
  broken: number;
  open: number;
  /** 0-100 of the promises that have actually been settled one way or the
   * other. Open ones are not counted: they have not been tested yet. */
  reliability: number;
}

/**
 * A customer's track record. What it is for is the question a collector asks
 * before believing the next promise.
 */
export function summarizePromises(
  statuses: readonly PromiseStatus[],
): PromiseRecord {
  const kept = statuses.filter((status) => status === "KEPT").length;
  const broken = statuses.filter((status) => status === "BROKEN").length;
  const open = statuses.filter((status) => status === "PENDING").length;
  const settled = kept + broken;

  return {
    total: statuses.length,
    kept,
    broken,
    open,
    reliability: settled === 0 ? 0 : Math.round((kept / settled) * 100),
  };
}
