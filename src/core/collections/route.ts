/**
 * Collection route logic.
 *
 * A route is the collector's day: an ordered list of doors to knock on, each
 * with an amount to ask for and a result to record. Everything here is pure,
 * so the rules about what a route is worth and when it is finished can be
 * checked without a database.
 */

import type { Cents } from "../money";

export const STOP_STATUSES = [
  "PENDING",
  "VISITED",
  "COLLECTED",
  "NOT_FOUND",
  "PROMISED",
  "REFUSED",
] as const;

export type StopStatus = (typeof STOP_STATUSES)[number];

/** A visit nobody has resolved yet still counts as work left to do. */
export function isStopOpen(status: StopStatus): boolean {
  return status === "PENDING";
}

/** Only a promise needs a date: the others say all there is to say. */
export function needsPromiseDate(status: StopStatus): boolean {
  return status === "PROMISED";
}

export interface RouteStopSummary {
  status: StopStatus;
  expectedCents: Cents;
  collectedCents: Cents;
}

export interface RouteProgress {
  total: number;
  visited: number;
  pending: number;
  collectedStops: number;
  expectedCents: Cents;
  collectedCents: Cents;
  /** 0-100, by visits resolved rather than by money: it is what a collector
   * can see progressing door by door. */
  percentVisited: number;
  /** 0-100 of the money the route set out to collect. */
  percentCollected: number;
}

export function summarizeRoute(
  stops: readonly RouteStopSummary[],
): RouteProgress {
  const total = stops.length;
  const pending = stops.filter((stop) => isStopOpen(stop.status)).length;
  const collectedStops = stops.filter(
    (stop) => stop.status === "COLLECTED",
  ).length;

  const expectedCents = stops.reduce(
    (sum, stop) => sum + stop.expectedCents,
    0,
  );
  const collectedCents = stops.reduce(
    (sum, stop) => sum + stop.collectedCents,
    0,
  );

  return {
    total,
    visited: total - pending,
    pending,
    collectedStops,
    expectedCents,
    collectedCents,
    percentVisited: percent(total - pending, total),
    percentCollected: percent(collectedCents, expectedCents),
  };
}

/** Whole percent, capped at 100: collecting more than expected is still a
 * finished route, not a 130% one. */
function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export interface Orderable {
  id: string;
  sortOrder: number;
}

/**
 * Moves one stop up or down, returning the pairs whose order changed.
 *
 * Returning the pairs rather than the whole list keeps the write down to the
 * two rows that actually moved.
 */
export function moveStop<T extends Orderable>(
  stops: readonly T[],
  stopId: string,
  direction: "up" | "down",
): Array<{ id: string; sortOrder: number }> {
  const ordered = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((stop) => stop.id === stopId);
  if (index === -1) return [];

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return [];

  const moving = ordered[index]!;
  const displaced = ordered[target]!;

  return [
    { id: moving.id, sortOrder: displaced.sortOrder },
    { id: displaced.id, sortOrder: moving.sortOrder },
  ];
}

/**
 * Renumbers a list from zero, closing the gaps that removing a stop leaves.
 */
export function resequence<T extends Orderable>(
  stops: readonly T[],
): Array<{ id: string; sortOrder: number }> {
  return [...stops]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((stop, index) =>
      // Only the rows that actually move are worth writing back.
      stop.sortOrder === index ? [] : [{ id: stop.id, sortOrder: index }],
    );
}
