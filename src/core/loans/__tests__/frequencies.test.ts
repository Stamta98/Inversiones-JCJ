import { describe, expect, it } from "vitest";

import { NoCollectionDayError, nextCollectionDay, weekdayOf } from "../../dates";
import { toCents } from "../../money";
import { ScheduleError, buildSchedule } from "../schedule";

/** 2026-03-02 is a Monday, which makes weekday expectations readable. */
const MONDAY = new Date(Date.UTC(2026, 2, 2));

const SUNDAY = 0;
const SATURDAY = 6;

function datesOf(
  overrides: Partial<Parameters<typeof buildSchedule>[0]> & {
    frequency: Parameters<typeof buildSchedule>[0]["frequency"];
    termCount: number;
  },
): string[] {
  return buildSchedule({
    principalCents: toCents(10000),
    interestRate: 5,
    interestMethod: "FLAT",
    firstDueDate: MONDAY,
    ...overrides,
  }).installments.map((installment) =>
    installment.dueDate.toISOString().slice(0, 10),
  );
}

describe("EVERY_OTHER_DAY", () => {
  it("collects one day yes, one day no", () => {
    expect(datesOf({ frequency: "EVERY_OTHER_DAY", termCount: 5 })).toEqual([
      "2026-03-02",
      "2026-03-04",
      "2026-03-06",
      "2026-03-08",
      "2026-03-10",
    ]);
  });
});

describe("TWICE_WEEKLY", () => {
  it("lands on the same two weekdays every week", () => {
    const dates = datesOf({ frequency: "TWICE_WEEKLY", termCount: 6 });
    expect(dates).toEqual([
      "2026-03-02", // lunes
      "2026-03-05", // jueves
      "2026-03-09", // lunes
      "2026-03-12", // jueves
      "2026-03-16", // lunes
      "2026-03-19", // jueves
    ]);

    const weekdays = new Set(
      dates.map((date) => weekdayOf(new Date(`${date}T00:00:00.000Z`))),
    );
    expect(weekdays.size).toBe(2);
  });
});

describe("CUSTOM", () => {
  it("repeats every N days", () => {
    expect(
      datesOf({ frequency: "CUSTOM", customIntervalDays: 10, termCount: 4 }),
    ).toEqual(["2026-03-02", "2026-03-12", "2026-03-22", "2026-04-01"]);
  });

  it("needs a whole number of days", () => {
    expect(() =>
      buildSchedule({
        principalCents: toCents(1000),
        interestRate: 5,
        interestMethod: "FLAT",
        frequency: "CUSTOM",
        termCount: 3,
        firstDueDate: MONDAY,
      }),
    ).toThrow(ScheduleError);

    expect(() =>
      buildSchedule({
        principalCents: toCents(1000),
        interestRate: 5,
        interestMethod: "FLAT",
        frequency: "CUSTOM",
        customIntervalDays: 0,
        termCount: 3,
        firstDueDate: MONDAY,
      }),
    ).toThrow(ScheduleError);
  });
});

describe("días sin cobro", () => {
  it("a daily loan skips Sunday instead of doubling up on Monday", () => {
    const dates = datesOf({
      frequency: "DAILY",
      termCount: 8,
      nonCollectionDays: [SUNDAY],
    });

    expect(dates).toEqual([
      "2026-03-02", // lunes
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07", // sábado
      "2026-03-09", // domingo saltado
      "2026-03-10",
    ]);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("skips a whole weekend when both days are blocked", () => {
    expect(
      datesOf({
        frequency: "DAILY",
        termCount: 7,
        nonCollectionDays: [SATURDAY, SUNDAY],
      }),
    ).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06", // viernes
      "2026-03-09", // lunes
      "2026-03-10",
    ]);
  });

  it("moves the first installment forward when it falls on a blocked day", () => {
    // 2026-03-01 is a Sunday.
    expect(
      datesOf({
        frequency: "WEEKLY",
        termCount: 3,
        firstDueDate: new Date(Date.UTC(2026, 2, 1)),
        nonCollectionDays: [SUNDAY],
      }),
    ).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
  });

  it("keeps a monthly loan on its day of the month, only nudging the blocked one", () => {
    // The 5th falls on a Sunday in April 2026; the rest must not drift.
    const dates = datesOf({
      frequency: "MONTHLY",
      termCount: 4,
      firstDueDate: new Date(Date.UTC(2026, 1, 5)),
      nonCollectionDays: [SUNDAY],
    });

    expect(dates).toEqual([
      "2026-02-05",
      "2026-03-05",
      "2026-04-06", // el 5 cae domingo, se corre al lunes
      "2026-05-05", // y el siguiente vuelve al 5
    ]);
  });

  it("keeps every other day alternating around a blocked day", () => {
    const dates = datesOf({
      frequency: "EVERY_OTHER_DAY",
      termCount: 5,
      firstDueDate: new Date(Date.UTC(2026, 2, 3)), // martes
      nonCollectionDays: [SUNDAY],
    });
    expect(dates).toEqual([
      "2026-03-03", // martes
      "2026-03-05", // jueves
      "2026-03-07", // sábado
      "2026-03-09", // domingo saltado -> lunes
      "2026-03-11",
    ]);
  });

  it("refuses a schedule with no collectable weekday", () => {
    expect(() =>
      datesOf({
        frequency: "DAILY",
        termCount: 3,
        nonCollectionDays: [0, 1, 2, 3, 4, 5, 6],
      }),
    ).toThrow(ScheduleError);
  });

  it("never produces a due date on a blocked weekday", () => {
    for (const frequency of [
      "DAILY",
      "EVERY_OTHER_DAY",
      "TWICE_WEEKLY",
      "WEEKLY",
      "BIWEEKLY",
      "SEMIMONTHLY",
      "MONTHLY",
    ] as const) {
      const dates = datesOf({
        frequency,
        termCount: 12,
        nonCollectionDays: [SUNDAY, SATURDAY],
      });
      for (const date of dates) {
        const day = weekdayOf(new Date(`${date}T00:00:00.000Z`));
        expect([SUNDAY, SATURDAY], `${frequency} -> ${date}`).not.toContain(day);
      }
    }
  });
});

describe("nextCollectionDay", () => {
  it("leaves an allowed day alone", () => {
    const monday = new Date(Date.UTC(2026, 2, 2));
    expect(nextCollectionDay(monday, [SUNDAY]).toISOString()).toBe(
      monday.toISOString(),
    );
  });

  it("moves forward, never backward", () => {
    const sunday = new Date(Date.UTC(2026, 2, 1));
    expect(nextCollectionDay(sunday, [SUNDAY]).toISOString().slice(0, 10)).toBe(
      "2026-03-02",
    );
  });

  it("throws when every day is blocked", () => {
    expect(() =>
      nextCollectionDay(MONDAY, [0, 1, 2, 3, 4, 5, 6]),
    ).toThrow(NoCollectionDayError);
  });
});
