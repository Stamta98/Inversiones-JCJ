import { describe, expect, it } from "vitest";

import {
  isStopOpen,
  moveStop,
  needsPromiseDate,
  resequence,
  summarizeRoute,
  type RouteStopSummary,
} from "../route";

function stop(
  status: RouteStopSummary["status"],
  expectedCents: number,
  collectedCents = 0,
): RouteStopSummary {
  return { status, expectedCents, collectedCents };
}

describe("isStopOpen", () => {
  it("counts only an unvisited stop as work left", () => {
    expect(isStopOpen("PENDING")).toBe(true);
    for (const status of ["VISITED", "COLLECTED", "NOT_FOUND", "PROMISED", "REFUSED"] as const) {
      expect(isStopOpen(status)).toBe(false);
    }
  });
});

describe("needsPromiseDate", () => {
  it("asks for a date only when the customer promised to pay", () => {
    expect(needsPromiseDate("PROMISED")).toBe(true);
    expect(needsPromiseDate("COLLECTED")).toBe(false);
  });
});

describe("summarizeRoute", () => {
  it("is all zeros for a route with no stops", () => {
    const progress = summarizeRoute([]);
    expect(progress).toMatchObject({
      total: 0,
      pending: 0,
      percentVisited: 0,
      percentCollected: 0,
    });
  });

  it("counts visits and money separately", () => {
    const progress = summarizeRoute([
      stop("COLLECTED", 100_00, 100_00),
      stop("REFUSED", 100_00),
      stop("PENDING", 200_00),
    ]);

    expect(progress.total).toBe(3);
    expect(progress.pending).toBe(1);
    expect(progress.visited).toBe(2);
    expect(progress.collectedStops).toBe(1);
    expect(progress.expectedCents).toBe(400_00);
    expect(progress.collectedCents).toBe(100_00);
    expect(progress.percentVisited).toBe(67);
    expect(progress.percentCollected).toBe(25);
  });

  it("caps a route that collected more than it expected", () => {
    const progress = summarizeRoute([stop("COLLECTED", 100_00, 250_00)]);
    expect(progress.percentCollected).toBe(100);
  });

  it("does not divide by zero when nothing was expected", () => {
    const progress = summarizeRoute([stop("COLLECTED", 0, 500_00)]);
    expect(progress.percentCollected).toBe(0);
    expect(progress.percentVisited).toBe(100);
  });
});

describe("moveStop", () => {
  const stops = [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ];

  it("swaps the two rows that moved and leaves the rest alone", () => {
    expect(moveStop(stops, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
    expect(moveStop(stops, "b", "down")).toEqual([
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 1 },
    ]);
  });

  it("does nothing at either end", () => {
    expect(moveStop(stops, "a", "up")).toEqual([]);
    expect(moveStop(stops, "c", "down")).toEqual([]);
  });

  it("does nothing for a stop that is not on the route", () => {
    expect(moveStop(stops, "zzz", "up")).toEqual([]);
  });

  it("works on orders with gaps, as removing a stop leaves", () => {
    const gappy = [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 5 },
      { id: "c", sortOrder: 9 },
    ];
    expect(moveStop(gappy, "c", "up")).toEqual([
      { id: "c", sortOrder: 5 },
      { id: "b", sortOrder: 9 },
    ]);
  });
});

describe("resequence", () => {
  it("closes the gaps a removal leaves", () => {
    expect(
      resequence([
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 2 },
        { id: "c", sortOrder: 7 },
      ]),
    ).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("writes nothing when the order is already tight", () => {
    expect(
      resequence([
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1 },
      ]),
    ).toEqual([]);
  });
});
