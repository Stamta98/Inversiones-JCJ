import { describe, expect, it } from "vitest";

import { fromCents, toCents } from "../../money";
import {
  allocatePayment,
  outstandingBalance,
  type AllocatableInstallment,
} from "../allocation";

function installment(
  overrides: Partial<AllocatableInstallment> & { number: number },
): AllocatableInstallment {
  return {
    id: `installment-${overrides.number}`,
    dueDate: new Date(Date.UTC(2026, 0, overrides.number)),
    principalCents: toCents(1000),
    interestCents: toCents(100),
    lateFeeCents: 0,
    paidCents: 0,
    status: "PENDING",
    ...overrides,
  };
}

describe("allocatePayment", () => {
  it("settles the oldest installment first", () => {
    const result = allocatePayment(toCents(1100), [
      installment({ number: 2 }),
      installment({ number: 1 }),
    ]);

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].installmentNumber).toBe(1);
    expect(result.allocations[0].resultingStatus).toBe("PAID");
    expect(result.unappliedCents).toBe(0);
  });

  it("applies late fee, then interest, then principal", () => {
    const result = allocatePayment(toCents(250), [
      installment({ number: 1, lateFeeCents: toCents(50) }),
    ]);

    const [allocation] = result.allocations;
    expect(fromCents(allocation.lateFeeCents)).toBe(50);
    expect(fromCents(allocation.interestCents)).toBe(100);
    expect(fromCents(allocation.principalCents)).toBe(100);
    expect(allocation.resultingStatus).toBe("PARTIALLY_PAID");
  });

  it("spreads a large payment across several installments", () => {
    const result = allocatePayment(toCents(2500), [
      installment({ number: 1 }),
      installment({ number: 2 }),
      installment({ number: 3 }),
    ]);

    expect(result.allocations.map((a) => a.installmentNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(result.allocations[0].resultingStatus).toBe("PAID");
    expect(result.allocations[1].resultingStatus).toBe("PAID");
    expect(result.allocations[2].resultingStatus).toBe("PARTIALLY_PAID");
    expect(fromCents(result.appliedCents)).toBe(2500);
  });

  it("reports leftover money once every installment is settled", () => {
    const result = allocatePayment(toCents(3000), [
      installment({ number: 1 }),
      installment({ number: 2 }),
    ]);

    expect(fromCents(result.appliedCents)).toBe(2200);
    expect(fromCents(result.unappliedCents)).toBe(800);
  });

  it("continues from a partially paid installment without double charging", () => {
    const result = allocatePayment(toCents(600), [
      installment({ number: 1, paidCents: toCents(500), status: "PARTIALLY_PAID" }),
    ]);

    const [allocation] = result.allocations;
    expect(fromCents(allocation.interestCents)).toBe(0);
    expect(fromCents(allocation.principalCents)).toBe(600);
    expect(allocation.resultingStatus).toBe("PAID");
  });

  it("skips installments already paid or waived", () => {
    const result = allocatePayment(toCents(1100), [
      installment({ number: 1, status: "PAID", paidCents: toCents(1100) }),
      installment({ number: 2, status: "WAIVED" }),
      installment({ number: 3 }),
    ]);

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].installmentNumber).toBe(3);
  });

  it("ignores a zero or negative payment", () => {
    expect(allocatePayment(0, [installment({ number: 1 })]).allocations).toEqual(
      [],
    );
    expect(
      allocatePayment(toCents(-50), [installment({ number: 1 })]).allocations,
    ).toEqual([]);
  });
});

describe("outstandingBalance", () => {
  it("adds up what is still owed, late fees included", () => {
    const balance = outstandingBalance([
      installment({ number: 1, paidCents: toCents(1100), status: "PAID" }),
      installment({ number: 2, lateFeeCents: toCents(75) }),
      installment({ number: 3, paidCents: toCents(400), status: "PARTIALLY_PAID" }),
    ]);

    expect(fromCents(balance)).toBe(1175 + 700);
  });
});
