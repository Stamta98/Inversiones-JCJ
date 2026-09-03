import { describe, expect, it } from "vitest";

import { installmentsCovered, isLate, maskDocument } from "../receipt";

describe("maskDocument", () => {
  it("keeps the ends so the customer recognises it", () => {
    expect(maskDocument("85123456754")).toBe("85*******54");
  });

  it("says nothing when there is nothing on file", () => {
    expect(maskDocument(null)).toBe("—");
    expect(maskDocument("  ")).toBe("—");
  });

  it("leaves a very short document alone rather than masking it to nothing", () => {
    expect(maskDocument("1234")).toBe("1234");
    expect(maskDocument("12")).toBe("12");
  });

  it("masks exactly the middle", () => {
    expect(maskDocument("12345")).toBe("12*45");
  });
});

describe("installmentsCovered", () => {
  it("counts part of an installment as the progress it is", () => {
    // 600.000 in 30 installments of 20.000; 68.000 paid is 3,4 of them.
    expect(installmentsCovered(68_000_00, 600_000_00, 30)).toBe(3.4);
  });

  it("counts whole installments exactly", () => {
    expect(installmentsCovered(120_000_00, 600_000_00, 5)).toBe(1);
  });

  it("is zero before anything is paid", () => {
    expect(installmentsCovered(0, 600_000_00, 30)).toBe(0);
  });

  it("never claims more installments than the loan has", () => {
    // Paying beyond the total does not make the loan longer.
    expect(installmentsCovered(900_000_00, 600_000_00, 5)).toBe(5);
  });

  it("does not divide by zero on a loan with nothing to pay", () => {
    expect(installmentsCovered(0, 0, 5)).toBe(0);
    expect(installmentsCovered(10_00, 600_000_00, 0)).toBe(0);
  });
});

describe("isLate", () => {
  it("is only late once a day has actually passed", () => {
    expect(isLate({ daysLate: 0 })).toBe(false);
    expect(isLate({ daysLate: 1 })).toBe(true);
  });
});
