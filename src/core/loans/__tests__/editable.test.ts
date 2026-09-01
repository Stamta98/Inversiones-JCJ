import { describe, expect, it } from "vitest";

import type { LoanStatus } from "../../types";
import {
  DESCRIPTIVE_FIELDS,
  FINANCIAL_FIELDS,
  canCancel,
  canEditAtAll,
  canEditTerms,
  editableFields,
  isEditable,
  lockedReasonKey,
} from "../editable";

const ALL_STATUSES: LoanStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "IN_ARREARS",
  "PAID",
  "CANCELLED",
  "WRITTEN_OFF",
];

describe("canEditTerms", () => {
  it("allows the terms only before the loan is committed", () => {
    expect(canEditTerms("DRAFT")).toBe(true);
    expect(canEditTerms("PENDING_APPROVAL")).toBe(true);
  });

  it("locks the terms once the money is out", () => {
    for (const status of ["APPROVED", "ACTIVE", "IN_ARREARS", "PAID"] as const) {
      expect(canEditTerms(status), status).toBe(false);
    }
  });
});

describe("editableFields", () => {
  it("gives everything on a draft", () => {
    const fields = editableFields("DRAFT");
    for (const field of [...FINANCIAL_FIELDS, ...DESCRIPTIVE_FIELDS]) {
      expect(fields, field).toContain(field);
    }
  });

  it("leaves only the descriptive fields on a live loan", () => {
    const fields = editableFields("ACTIVE");
    expect(fields).toEqual([...DESCRIPTIVE_FIELDS]);
    for (const field of FINANCIAL_FIELDS) {
      expect(fields, field).not.toContain(field);
    }
  });

  it("gives nothing on a closed loan", () => {
    expect(editableFields("CANCELLED")).toEqual([]);
    expect(editableFields("WRITTEN_OFF")).toEqual([]);
  });

  it("never lets the principal change on a loan with payments", () => {
    // The regression that matters: a live loan must never expose the money.
    for (const status of ALL_STATUSES) {
      if (status === "DRAFT" || status === "PENDING_APPROVAL") continue;
      expect(isEditable(status, "principal"), status).toBe(false);
      expect(isEditable(status, "interestRate"), status).toBe(false);
      expect(isEditable(status, "termCount"), status).toBe(false);
      expect(isEditable(status, "firstDueDate"), status).toBe(false);
    }
  });
});

describe("canEditAtAll", () => {
  it("treats a closed loan as a record", () => {
    expect(canEditAtAll("CANCELLED")).toBe(false);
    expect(canEditAtAll("WRITTEN_OFF")).toBe(false);
    expect(canEditAtAll("PAID")).toBe(true);
  });
});

describe("canCancel", () => {
  it("only allows cancelling a loan that is still open", () => {
    expect(canCancel("DRAFT")).toBe(true);
    expect(canCancel("ACTIVE")).toBe(true);
    expect(canCancel("IN_ARREARS")).toBe(true);
    expect(canCancel("PAID")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
  });
});

describe("lockedReasonKey", () => {
  it("explains why, so the screen can tell the user", () => {
    expect(lockedReasonKey("DRAFT")).toBeNull();
    expect(lockedReasonKey("ACTIVE")).toBe("loans.editLockedDisbursed");
    expect(lockedReasonKey("CANCELLED")).toBe("loans.editLockedClosed");
  });
});
