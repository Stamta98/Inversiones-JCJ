import { describe, expect, it } from "vitest";

import { bucketOf, evaluatePromise, summarizePromises } from "../promise";

const today = new Date("2026-09-02T00:00:00.000Z");
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("evaluatePromise", () => {
  it("is open while the day has not arrived", () => {
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 0,
        promisedFor: day("2026-09-05"),
        today,
      }),
    ).toMatchObject({ status: "PENDING", remainingCents: 2_400_00, daysLeft: 3 });
  });

  it("is still open on the promised day itself", () => {
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 0,
        promisedFor: today,
        today,
      }),
    ).toMatchObject({ status: "PENDING", daysLeft: 0 });
  });

  it("is kept once the full amount is paid", () => {
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 2_400_00,
        promisedFor: day("2026-09-05"),
        today,
      }),
    ).toMatchObject({ status: "KEPT", remainingCents: 0 });
  });

  it("is kept when they paid more than they promised", () => {
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 3_000_00,
        promisedFor: day("2026-09-05"),
        today,
      }).status,
    ).toBe("KEPT");
  });

  it("counts a late but complete payment as kept", () => {
    // Paying two days late is still paying: what is broken is not paying.
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 2_400_00,
        promisedFor: day("2026-08-31"),
        today,
      }).status,
    ).toBe("KEPT");
  });

  it("does not let a part payment pass for a kept promise", () => {
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 2_399_00,
        promisedFor: day("2026-09-01"),
        today,
      }),
    ).toMatchObject({ status: "BROKEN", remainingCents: 1_00 });
  });

  it("breaks once the day has passed with nothing paid", () => {
    expect(
      evaluatePromise({
        promisedCents: 2_400_00,
        paidCents: 0,
        promisedFor: day("2026-08-28"),
        today,
      }),
    ).toMatchObject({ status: "BROKEN", daysLeft: -5 });
  });
});

describe("bucketOf", () => {
  it("sorts open promises by their day", () => {
    expect(bucketOf("PENDING", day("2026-08-30"), today)).toBe("overdue");
    expect(bucketOf("PENDING", today, today)).toBe("today");
    expect(bucketOf("PENDING", day("2026-09-09"), today)).toBe("upcoming");
  });

  it("keeps a broken promise in sight whatever its date", () => {
    expect(bucketOf("BROKEN", day("2026-09-09"), today)).toBe("overdue");
  });

  it("puts settled promises away", () => {
    expect(bucketOf("KEPT", day("2026-08-30"), today)).toBe("closed");
    expect(bucketOf("CANCELLED", today, today)).toBe("closed");
  });
});

describe("summarizePromises", () => {
  it("has nothing to say about a customer with no promises", () => {
    expect(summarizePromises([])).toMatchObject({ total: 0, reliability: 0 });
  });

  it("does not judge on promises that have not come due", () => {
    // Two open promises are not a 0% record; they are no record at all.
    expect(summarizePromises(["PENDING", "PENDING"])).toMatchObject({
      open: 2,
      reliability: 0,
      kept: 0,
      broken: 0,
    });
  });

  it("scores only what has actually been settled", () => {
    expect(summarizePromises(["KEPT", "KEPT", "BROKEN", "PENDING"])).toMatchObject({
      total: 4,
      kept: 2,
      broken: 1,
      open: 1,
      reliability: 67,
    });
  });

  it("ignores a cancelled promise on both sides of the ratio", () => {
    expect(summarizePromises(["KEPT", "CANCELLED"]).reliability).toBe(100);
  });
});
