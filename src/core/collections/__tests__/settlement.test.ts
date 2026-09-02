import { describe, expect, it } from "vitest";

import { settle, summarizeCollector } from "../settlement";

describe("settle", () => {
  it("says nothing is wrong when the count matches", () => {
    const result = settle(12_450_00, 12_450_00);
    expect(result.differenceCents).toBe(0);
    expect(result.result).toBe("balanced");
  });

  it("calls missing money short, not a negative overage", () => {
    const result = settle(12_450_00, 12_000_00);
    expect(result.differenceCents).toBe(-450_00);
    expect(result.result).toBe("short");
  });

  it("calls extra money over", () => {
    const result = settle(12_000_00, 12_450_00);
    expect(result.differenceCents).toBe(450_00);
    expect(result.result).toBe("over");
  });

  it("handles a collector who handed over nothing", () => {
    expect(settle(5_000_00, 0)).toMatchObject({
      differenceCents: -5_000_00,
      result: "short",
    });
  });

  it("is balanced when the route collected nothing and nothing came back", () => {
    expect(settle(0, 0).result).toBe("balanced");
  });

  it("does not invent a difference out of rounding residue", () => {
    // Colombian pesos have no cents, so a sum that lands just off a whole peso
    // is arithmetic residue, not money anyone could hand over.
    const result = settle(150_000_49, 150_000_00, 100);
    expect(result.differenceCents).toBe(0);
    expect(result.result).toBe("balanced");
  });

  it("still catches a real shortfall in a currency without cents", () => {
    const result = settle(150_000_00, 145_000_00, 100);
    expect(result.differenceCents).toBe(-5_000_00);
    expect(result.result).toBe("short");
  });
});

describe("summarizeCollector", () => {
  it("is empty for a collector who has never settled", () => {
    expect(summarizeCollector([])).toMatchObject({
      settlements: 0,
      balanced: 0,
      netCents: 0,
    });
  });

  it("keeps shortfalls and overages apart", () => {
    // Someone 500 short one day and 500 over the next does not "always cuadra".
    const record = summarizeCollector([-500_00, 500_00]);
    expect(record.balanced).toBe(0);
    expect(record.short).toBe(1);
    expect(record.over).toBe(1);
    expect(record.totalShortCents).toBe(500_00);
    expect(record.totalOverCents).toBe(500_00);
    expect(record.netCents).toBe(0);
  });

  it("adds up a run of days", () => {
    const record = summarizeCollector([0, -450_00, 0, -100_00, 25_00]);
    expect(record).toMatchObject({
      settlements: 5,
      balanced: 2,
      short: 2,
      over: 1,
      totalShortCents: 550_00,
      totalOverCents: 25_00,
      netCents: -525_00,
    });
  });
});
