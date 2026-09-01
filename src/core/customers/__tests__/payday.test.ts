import { describe, expect, it } from "vitest";

import {
  needsDayOfMonth,
  needsWeekday,
  nextPayday,
  suggestFirstDueDate,
} from "../payday";

/** 2026-03-04 is a Wednesday. */
const WEDNESDAY = new Date(Date.UTC(2026, 2, 4));

const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

describe("nextPayday", () => {
  it("is tomorrow for someone who earns every day", () => {
    expect(iso(nextPayday({ kind: "DAILY" }, WEDNESDAY))).toBe("2026-03-05");
  });

  it("finds the next occurrence of the weekday", () => {
    // Friday is 5.
    expect(iso(nextPayday({ kind: "WEEKLY", weekday: 5 }, WEDNESDAY))).toBe(
      "2026-03-06",
    );
  });

  it("jumps a full week when payday is today", () => {
    // Wednesday is 3, and today is Wednesday.
    expect(iso(nextPayday({ kind: "WEEKLY", weekday: 3 }, WEDNESDAY))).toBe(
      "2026-03-11",
    );
  });

  it("alternates the 15th and the end of the month", () => {
    expect(iso(nextPayday({ kind: "SEMIMONTHLY" }, WEDNESDAY))).toBe(
      "2026-03-15",
    );
    expect(
      iso(nextPayday({ kind: "SEMIMONTHLY" }, new Date(Date.UTC(2026, 2, 20)))),
    ).toBe("2026-03-31");
    expect(
      iso(nextPayday({ kind: "SEMIMONTHLY" }, new Date(Date.UTC(2026, 2, 31)))),
    ).toBe("2026-04-15");
  });

  it("finds the day of the month, this month or the next", () => {
    expect(iso(nextPayday({ kind: "MONTHLY", dayOfMonth: 28 }, WEDNESDAY))).toBe(
      "2026-03-28",
    );
    expect(iso(nextPayday({ kind: "MONTHLY", dayOfMonth: 1 }, WEDNESDAY))).toBe(
      "2026-04-01",
    );
  });

  it("clamps a day of month that the month does not have", () => {
    // February 2026 has 28 days.
    expect(
      iso(nextPayday({ kind: "MONTHLY", dayOfMonth: 31 }, new Date(Date.UTC(2026, 1, 10)))),
    ).toBe("2026-02-28");
  });

  it("gives nothing for an irregular income or a missing detail", () => {
    expect(nextPayday({ kind: "IRREGULAR" }, WEDNESDAY)).toBeNull();
    expect(nextPayday({ kind: null }, WEDNESDAY)).toBeNull();
    expect(nextPayday({ kind: "WEEKLY" }, WEDNESDAY)).toBeNull();
    expect(nextPayday({ kind: "MONTHLY" }, WEDNESDAY)).toBeNull();
  });
});

describe("suggestFirstDueDate", () => {
  it("lands the day after payday", () => {
    expect(
      iso(suggestFirstDueDate({ kind: "WEEKLY", weekday: 5 }, WEDNESDAY)),
    ).toBe("2026-03-07");
  });

  it("respects a custom grace period", () => {
    expect(
      iso(
        suggestFirstDueDate({ kind: "WEEKLY", weekday: 5 }, WEDNESDAY, {
          graceDays: 0,
        }),
      ),
    ).toBe("2026-03-06");
  });

  it("never lands on a day the business does not collect", () => {
    // Payday Saturday (6) + 1 day = Sunday, which is blocked.
    expect(
      iso(
        suggestFirstDueDate({ kind: "WEEKLY", weekday: 6 }, WEDNESDAY, {
          nonCollectionDays: [0],
        }),
      ),
    ).toBe("2026-03-09");
  });

  it("gives nothing when there is no pattern to go on", () => {
    expect(suggestFirstDueDate({ kind: "IRREGULAR" }, WEDNESDAY)).toBeNull();
  });
});

describe("needsWeekday / needsDayOfMonth", () => {
  it("knows which kinds need extra detail", () => {
    expect(needsWeekday("WEEKLY")).toBe(true);
    expect(needsWeekday("BIWEEKLY")).toBe(true);
    expect(needsWeekday("MONTHLY")).toBe(false);
    expect(needsDayOfMonth("MONTHLY")).toBe(true);
    expect(needsDayOfMonth("SEMIMONTHLY")).toBe(false);
  });
});
