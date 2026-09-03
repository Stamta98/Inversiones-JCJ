import { describe, expect, it } from "vitest";

import { buildSchedule, type ScheduleInput } from "../schedule";

/** "Le presto 100 mil al 20% a 30 días, me paga 4 mil diarios." */
const streetLoan: ScheduleInput = {
  principalCents: 100_000_00,
  interestRate: 20,
  rateBasis: "TOTAL",
  interestMethod: "FLAT",
  frequency: "DAILY",
  termCount: 30,
  firstDueDate: new Date("2026-09-04T00:00:00.000Z"),
};

describe("a rate quoted over the whole loan", () => {
  it("charges the headline percentage once, not once per installment", () => {
    const schedule = buildSchedule(streetLoan);

    expect(schedule.totalInterestCents).toBe(20_000_00);
    expect(schedule.totalToPayCents).toBe(120_000_00);
  });

  it("splits it into the installments the lender quoted", () => {
    const schedule = buildSchedule(streetLoan);

    expect(schedule.installments).toHaveLength(30);
    for (const installment of schedule.installments) {
      expect(installment.totalCents).toBe(4_000_00);
    }
  });

  it("still adds up when the term does not divide the interest evenly", () => {
    const schedule = buildSchedule({ ...streetLoan, termCount: 7 });

    const summed = schedule.installments.reduce(
      (total, installment) => total + installment.totalCents,
      0,
    );
    expect(summed).toBe(schedule.totalToPayCents);
    expect(schedule.totalInterestCents).toBe(20_000_00);
  });

  it("reads the same rate per installment when told to", () => {
    // The old meaning, kept for "5% mensual" over a year and the like.
    const schedule = buildSchedule({ ...streetLoan, rateBasis: "PER_PERIOD" });

    expect(schedule.totalInterestCents).toBe(600_000_00);
  });

  it("keeps the per installment reading as the default", () => {
    const withoutBasis: ScheduleInput = { ...streetLoan };
    delete withoutBasis.rateBasis;
    const schedule = buildSchedule(withoutBasis);

    expect(schedule.totalInterestCents).toBe(600_000_00);
  });
});

describe("the whole loan basis across the other methods", () => {
  it("charges interest only until the end on an American loan", () => {
    const schedule = buildSchedule({
      ...streetLoan,
      interestMethod: "AMERICAN",
      frequency: "MONTHLY",
      termCount: 4,
    });

    expect(schedule.totalInterestCents).toBe(20_000_00);
    expect(schedule.totalPrincipalCents).toBe(100_000_00);
    // Every installment is interest, and the last one carries the capital.
    expect(schedule.installments[0]!.principalCents).toBe(0);
    expect(schedule.installments[3]!.principalCents).toBe(100_000_00);
    expect(schedule.installments[0]!.interestCents).toBe(5_000_00);
  });

  it("spreads the rate over the term for a French loan", () => {
    const total = buildSchedule({
      ...streetLoan,
      interestMethod: "FRENCH",
      frequency: "MONTHLY",
      termCount: 10,
    });
    const perPeriod = buildSchedule({
      ...streetLoan,
      interestMethod: "FRENCH",
      frequency: "MONTHLY",
      termCount: 10,
      rateBasis: "PER_PERIOD",
    });

    // Charging on the falling balance costs less than the flat headline, and
    // far less than reading the same number as 20% every month.
    expect(total.totalInterestCents).toBeLessThan(20_000_00);
    expect(total.totalInterestCents).toBeLessThan(perPeriod.totalInterestCents);
  });

  it("never leaves the installments disagreeing with the total", () => {
    for (const method of ["FLAT", "FRENCH", "GERMAN", "AMERICAN"] as const) {
      for (const termCount of [3, 7, 13, 30]) {
        const schedule = buildSchedule({
          ...streetLoan,
          interestMethod: method,
          termCount,
        });
        const summed = schedule.installments.reduce(
          (total, installment) => total + installment.totalCents,
          0,
        );
        expect({ method, termCount, summed }).toEqual({
          method,
          termCount,
          summed: schedule.totalToPayCents,
        });
      }
    }
  });
});
