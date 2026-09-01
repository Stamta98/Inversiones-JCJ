import { describe, expect, it } from "vitest";

import { fromCents, toCents } from "../../money";
import {
  calculateLateFee,
  chargeableLateDays,
  daysOverdue,
  summarizeArrears,
  type InstallmentSnapshot,
  type LateFeePolicy,
} from "../arrears";

const dueDate = new Date(Date.UTC(2026, 0, 10));

function snapshot(
  overrides: Partial<InstallmentSnapshot> = {},
): InstallmentSnapshot {
  return {
    id: "installment-1",
    number: 1,
    dueDate,
    principalCents: toCents(1000),
    interestCents: toCents(100),
    lateFeeCents: 0,
    paidCents: 0,
    status: "PENDING",
    ...overrides,
  };
}

describe("daysOverdue", () => {
  it("counts only days past the due date", () => {
    expect(daysOverdue(dueDate, new Date(Date.UTC(2026, 0, 5)))).toBe(0);
    expect(daysOverdue(dueDate, dueDate)).toBe(0);
    expect(daysOverdue(dueDate, new Date(Date.UTC(2026, 0, 18)))).toBe(8);
  });
});

describe("chargeableLateDays", () => {
  it("consumes the grace period before charging", () => {
    const asOf = new Date(Date.UTC(2026, 0, 18));
    expect(chargeableLateDays(dueDate, asOf, 0)).toBe(8);
    expect(chargeableLateDays(dueDate, asOf, 3)).toBe(5);
    expect(chargeableLateDays(dueDate, asOf, 30)).toBe(0);
  });
});

describe("calculateLateFee", () => {
  const asOf = new Date(Date.UTC(2026, 0, 20));

  it("returns nothing when there is no policy", () => {
    const policy: LateFeePolicy = {
      mode: "NONE",
      value: 10,
      gracePeriodDays: 0,
    };
    expect(calculateLateFee(snapshot(), policy, asOf)).toBe(0);
  });

  it("charges a one off percentage of the unpaid balance", () => {
    const policy: LateFeePolicy = {
      mode: "PERCENT_OF_INSTALLMENT",
      value: 5,
      gracePeriodDays: 0,
    };
    expect(fromCents(calculateLateFee(snapshot(), policy, asOf))).toBe(55);
  });

  it("charges a daily percentage for every late day", () => {
    const policy: LateFeePolicy = {
      mode: "PERCENT_PER_DAY",
      value: 1,
      gracePeriodDays: 0,
    };
    // 10 days late, 1% of 1,100 per day.
    expect(fromCents(calculateLateFee(snapshot(), policy, asOf))).toBe(110);
  });

  it("charges a fixed amount per late day", () => {
    const policy: LateFeePolicy = {
      mode: "FIXED_PER_DAY",
      value: toCents(25),
      gracePeriodDays: 2,
    };
    // 8 chargeable days after a 2 day grace period.
    expect(fromCents(calculateLateFee(snapshot(), policy, asOf))).toBe(200);
  });

  it("only charges over the unpaid portion", () => {
    const policy: LateFeePolicy = {
      mode: "PERCENT_OF_INSTALLMENT",
      value: 10,
      gracePeriodDays: 0,
    };
    const partial = snapshot({
      paidCents: toCents(600),
      status: "PARTIALLY_PAID",
    });
    expect(fromCents(calculateLateFee(partial, policy, asOf))).toBe(50);
  });

  it("respects the cap", () => {
    const policy: LateFeePolicy = {
      mode: "PERCENT_PER_DAY",
      value: 5,
      gracePeriodDays: 0,
      maxPercentOfInstallment: 20,
    };
    expect(fromCents(calculateLateFee(snapshot(), policy, asOf))).toBe(220);
  });

  it("never charges a settled installment", () => {
    const policy: LateFeePolicy = {
      mode: "PERCENT_PER_DAY",
      value: 5,
      gracePeriodDays: 0,
    };
    expect(
      calculateLateFee(
        snapshot({ status: "PAID", paidCents: toCents(1100) }),
        policy,
        asOf,
      ),
    ).toBe(0);
  });
});

describe("summarizeArrears", () => {
  const policy: LateFeePolicy = {
    mode: "PERCENT_OF_INSTALLMENT",
    value: 10,
    gracePeriodDays: 0,
  };

  it("reports the oldest overdue installment as the arrears age", () => {
    const summary = summarizeArrears(
      [
        snapshot({
          id: "a",
          number: 1,
          dueDate: new Date(Date.UTC(2026, 0, 1)),
        }),
        snapshot({
          id: "b",
          number: 2,
          dueDate: new Date(Date.UTC(2026, 0, 15)),
        }),
        snapshot({
          id: "c",
          number: 3,
          dueDate: new Date(Date.UTC(2026, 1, 20)),
        }),
      ],
      policy,
      new Date(Date.UTC(2026, 0, 21)),
    );

    expect(summary.daysInArrears).toBe(20);
    expect(summary.overdueInstallmentCount).toBe(2);
    expect(fromCents(summary.overdueAmountCents)).toBe(2200);
    expect(fromCents(summary.lateFeeCents)).toBe(220);
    expect(summary.oldestOverdueDueDate?.toISOString().slice(0, 10)).toBe(
      "2026-01-01",
    );
  });

  it("reports a clean loan as up to date", () => {
    const summary = summarizeArrears(
      [snapshot({ status: "PAID", paidCents: toCents(1100) })],
      policy,
      new Date(Date.UTC(2026, 2, 1)),
    );

    expect(summary.daysInArrears).toBe(0);
    expect(summary.overdueInstallmentCount).toBe(0);
    expect(summary.oldestOverdueDueDate).toBeNull();
  });
});
