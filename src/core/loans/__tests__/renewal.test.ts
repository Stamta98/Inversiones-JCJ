import { describe, expect, it } from "vitest";

import { RenewalError, planRenewal } from "../renewal";

describe("planRenewal", () => {
  // The example the lender gave: 500.000 lent, 200.000 still owed, and the
  // customer cannot pay it, so the 200.000 becomes the new loan.
  it("turns the balance into the new loan when refinancing", () => {
    const plan = planRenewal({
      kind: "REFINANCE",
      outstandingCents: 20_000_000,
      step: 100,
    });

    expect(plan.settledCents).toBe(20_000_000);
    expect(plan.newPrincipalCents).toBe(20_000_000);
    expect(plan.cashOutCents).toBe(0);
  });

  it("ignores a principal offered to a refinance", () => {
    const plan = planRenewal({
      kind: "REFINANCE",
      outstandingCents: 20_000_000,
      newPrincipalCents: 90_000_000,
      step: 100,
    });

    expect(plan.newPrincipalCents).toBe(20_000_000);
  });

  // The other example: owes 100.000, asks for 500.000 again, walks away with
  // 400.000 and owes the whole 500.000 plus interest.
  it("discounts the balance from what a renewal hands over", () => {
    const plan = planRenewal({
      kind: "RENEWAL",
      outstandingCents: 10_000_000,
      newPrincipalCents: 50_000_000,
      step: 100,
    });

    expect(plan.settledCents).toBe(10_000_000);
    expect(plan.newPrincipalCents).toBe(50_000_000);
    expect(plan.cashOutCents).toBe(40_000_000);
  });

  it("refuses a loan with nothing left to carry over", () => {
    expect(() =>
      planRenewal({ kind: "REFINANCE", outstandingCents: 0 }),
    ).toThrow(RenewalError);

    try {
      planRenewal({ kind: "RENEWAL", outstandingCents: 0, newPrincipalCents: 1 });
    } catch (error) {
      expect((error as RenewalError).code).toBe("noBalance");
    }
  });

  // Renewing for the balance hands the customer nothing; below it would
  // quietly forgive the difference. Neither is a renewal.
  it("refuses a renewal that is not new money", () => {
    for (const newPrincipalCents of [10_000_000, 9_000_000]) {
      try {
        planRenewal({
          kind: "RENEWAL",
          outstandingCents: 10_000_000,
          newPrincipalCents,
          step: 100,
        });
        throw new Error("should have refused");
      } catch (error) {
        expect((error as RenewalError).code).toBe("notNewMoney");
      }
    }
  });

  it("refuses a renewal with no amount", () => {
    try {
      planRenewal({ kind: "RENEWAL", outstandingCents: 10_000_000 });
      throw new Error("should have refused");
    } catch (error) {
      expect((error as RenewalError).code).toBe("principal");
    }
  });

  // A currency without cents cannot hand over a balance ending in centavos.
  it("rounds to what the currency can actually hand over", () => {
    const plan = planRenewal({
      kind: "RENEWAL",
      outstandingCents: 10_000_049,
      newPrincipalCents: 50_000_051,
      step: 100,
    });

    expect(plan.settledCents).toBe(10_000_000);
    expect(plan.newPrincipalCents).toBe(50_000_100);
    expect(plan.cashOutCents).toBe(40_000_100);
  });

  it("keeps the centavos when the currency has them", () => {
    const plan = planRenewal({
      kind: "REFINANCE",
      outstandingCents: 20_000_049,
    });

    expect(plan.newPrincipalCents).toBe(20_000_049);
  });
});
