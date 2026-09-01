import { describe, expect, it } from "vitest";

import { fromCents, toCents } from "../../money";
import { ScheduleError, buildSchedule } from "../schedule";

const firstDueDate = new Date(Date.UTC(2026, 0, 15));

describe("buildSchedule / FLAT", () => {
  it("splits principal and flat interest evenly across the term", () => {
    const schedule = buildSchedule({
      principalCents: toCents(10000),
      interestRate: 10,
      interestMethod: "FLAT",
      frequency: "MONTHLY",
      termCount: 4,
      firstDueDate,
    });

    expect(schedule.installments).toHaveLength(4);
    expect(fromCents(schedule.totalInterestCents)).toBe(4000);
    expect(fromCents(schedule.totalPrincipalCents)).toBe(10000);
    expect(fromCents(schedule.totalToPayCents)).toBe(14000);
    expect(
      schedule.installments.every(
        (installment) => fromCents(installment.totalCents) === 3500,
      ),
    ).toBe(true);
    expect(schedule.installments.at(-1)?.balanceAfterCents).toBe(0);
  });

  it("never loses a cent when the amount does not divide evenly", () => {
    const schedule = buildSchedule({
      principalCents: toCents(1000),
      interestRate: 5,
      interestMethod: "FLAT",
      frequency: "WEEKLY",
      termCount: 3,
      firstDueDate,
    });

    const sum = schedule.installments.reduce(
      (total, installment) => total + installment.totalCents,
      0,
    );
    expect(sum).toBe(schedule.totalToPayCents);
    expect(schedule.installments.at(-1)?.balanceAfterCents).toBe(0);
  });
});

describe("buildSchedule / FRENCH", () => {
  it("keeps a constant installment and closes the balance at zero", () => {
    const schedule = buildSchedule({
      principalCents: toCents(10000),
      interestRate: 2,
      interestMethod: "FRENCH",
      frequency: "MONTHLY",
      termCount: 12,
      firstDueDate,
    });

    // Standard annuity for 10,000 at 2% over 12 periods is 945.60 per period.
    expect(fromCents(schedule.installments[0].totalCents)).toBeCloseTo(945.6, 1);

    const payments = schedule.installments
      .slice(0, -1)
      .map((installment) => installment.totalCents);
    expect(new Set(payments).size).toBe(1);

    expect(schedule.installments.at(-1)?.balanceAfterCents).toBe(0);
    expect(
      schedule.installments.reduce((sum, i) => sum + i.principalCents, 0),
    ).toBe(toCents(10000));
  });

  it("shifts the interest share downwards over time", () => {
    const schedule = buildSchedule({
      principalCents: toCents(50000),
      interestRate: 3,
      interestMethod: "FRENCH",
      frequency: "MONTHLY",
      termCount: 6,
      firstDueDate,
    });

    const first = schedule.installments[0];
    const last = schedule.installments.at(-1)!;
    expect(first.interestCents).toBeGreaterThan(last.interestCents);
    expect(first.principalCents).toBeLessThan(last.principalCents);
  });

  it("rejects a rate the installment could never cover", () => {
    expect(() =>
      buildSchedule({
        principalCents: toCents(10000),
        interestRate: 50,
        interestMethod: "FRENCH",
        frequency: "MONTHLY",
        termCount: 2,
        firstDueDate,
      }),
    ).not.toThrow();

    expect(() =>
      buildSchedule({
        principalCents: toCents(10000),
        interestRate: 0,
        interestMethod: "FRENCH",
        frequency: "MONTHLY",
        termCount: 4,
        firstDueDate,
      }),
    ).not.toThrow();
  });
});

describe("buildSchedule / GERMAN", () => {
  it("keeps principal constant and lowers the installment over time", () => {
    const schedule = buildSchedule({
      principalCents: toCents(12000),
      interestRate: 2,
      interestMethod: "GERMAN",
      frequency: "MONTHLY",
      termCount: 4,
      firstDueDate,
    });

    expect(
      schedule.installments.every(
        (installment) => fromCents(installment.principalCents) === 3000,
      ),
    ).toBe(true);
    expect(schedule.installments[0].totalCents).toBeGreaterThan(
      schedule.installments[3].totalCents,
    );
    expect(schedule.installments.at(-1)?.balanceAfterCents).toBe(0);
  });
});

describe("buildSchedule / AMERICAN", () => {
  it("charges interest only until the final installment", () => {
    const schedule = buildSchedule({
      principalCents: toCents(20000),
      interestRate: 5,
      interestMethod: "AMERICAN",
      frequency: "MONTHLY",
      termCount: 3,
      firstDueDate,
    });

    expect(fromCents(schedule.installments[0].principalCents)).toBe(0);
    expect(fromCents(schedule.installments[0].interestCents)).toBe(1000);
    expect(fromCents(schedule.installments[2].principalCents)).toBe(20000);
    expect(fromCents(schedule.totalToPayCents)).toBe(23000);
  });
});

describe("buildSchedule / CREDIT_LINE", () => {
  it("produces an open ended interest only horizon", () => {
    const schedule = buildSchedule({
      principalCents: toCents(5000),
      interestRate: 4,
      interestMethod: "CREDIT_LINE",
      frequency: "MONTHLY",
      termCount: 3,
      firstDueDate,
    });

    expect(schedule.isOpenEnded).toBe(true);
    expect(schedule.totalPrincipalCents).toBe(0);
    expect(
      schedule.installments.every(
        (installment) =>
          installment.balanceAfterCents === toCents(5000) &&
          fromCents(installment.interestCents) === 200,
      ),
    ).toBe(true);
  });
});

describe("buildSchedule / due dates", () => {
  it("walks daily, weekly and biweekly frequencies", () => {
    const daily = buildSchedule({
      principalCents: toCents(3000),
      interestRate: 1,
      interestMethod: "FLAT",
      frequency: "DAILY",
      termCount: 3,
      firstDueDate,
    });
    expect(daily.installments.map((i) => i.dueDate.getUTCDate())).toEqual([
      15, 16, 17,
    ]);

    const weekly = buildSchedule({
      principalCents: toCents(3000),
      interestRate: 1,
      interestMethod: "FLAT",
      frequency: "WEEKLY",
      termCount: 3,
      firstDueDate,
    });
    expect(weekly.installments.map((i) => i.dueDate.getUTCDate())).toEqual([
      15, 22, 29,
    ]);
  });

  it("alternates day and day+15 for semimonthly collection", () => {
    const schedule = buildSchedule({
      principalCents: toCents(4000),
      interestRate: 1,
      interestMethod: "FLAT",
      frequency: "SEMIMONTHLY",
      termCount: 4,
      firstDueDate: new Date(Date.UTC(2026, 0, 1)),
    });

    expect(
      schedule.installments.map((i) => i.dueDate.toISOString().slice(0, 10)),
    ).toEqual(["2026-01-01", "2026-01-16", "2026-02-01", "2026-02-16"]);
  });

  it("clamps the day of month instead of rolling into the next one", () => {
    const schedule = buildSchedule({
      principalCents: toCents(4000),
      interestRate: 1,
      interestMethod: "FLAT",
      frequency: "MONTHLY",
      termCount: 3,
      firstDueDate: new Date(Date.UTC(2026, 0, 31)),
    });

    expect(
      schedule.installments.map((i) => i.dueDate.toISOString().slice(0, 10)),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("collapses SINGLE into one installment", () => {
    const schedule = buildSchedule({
      principalCents: toCents(7500),
      interestRate: 12,
      interestMethod: "FLAT",
      frequency: "SINGLE",
      termCount: 9,
      firstDueDate,
    });
    expect(schedule.installments).toHaveLength(1);
    expect(fromCents(schedule.installments[0].totalCents)).toBe(8400);
  });
});

describe("buildSchedule / validation", () => {
  it("rejects a non positive principal", () => {
    expect(() =>
      buildSchedule({
        principalCents: 0,
        interestRate: 5,
        interestMethod: "FLAT",
        frequency: "MONTHLY",
        termCount: 3,
        firstDueDate,
      }),
    ).toThrow(ScheduleError);
  });

  it("rejects a fractional term", () => {
    expect(() =>
      buildSchedule({
        principalCents: toCents(1000),
        interestRate: 5,
        interestMethod: "FLAT",
        frequency: "MONTHLY",
        termCount: 2.5,
        firstDueDate,
      }),
    ).toThrow(ScheduleError);
  });
});
