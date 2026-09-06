import { describe, expect, it } from "vitest";

import type { LoanStatus } from "../../types";
import {
  DESCRIPTIVE_FIELDS,
  FINANCIAL_FIELDS,
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
  // Quien presta se equivoca tecleando, y anular el préstamo para volver a
  // empezar no arregla nada: mientras el préstamo siga vivo se corrige, y el
  // servicio rehace el plan y vuelve a repartir sobre él lo ya cobrado.
  it("lets a live loan be corrected", () => {
    for (const status of [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "ACTIVE",
      "IN_ARREARS",
    ] as const) {
      expect(canEditTerms(status), status).toBe(true);
    }
  });

  it("leaves a closed loan alone", () => {
    for (const status of ["PAID", "CANCELLED", "WRITTEN_OFF"] as const) {
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

  it("gives everything on a live loan too", () => {
    const fields = editableFields("ACTIVE");
    for (const field of [...FINANCIAL_FIELDS, ...DESCRIPTIVE_FIELDS]) {
      expect(fields, field).toContain(field);
    }
  });

  // Un préstamo saldado es historia: reescribirlo cambiaría lo que ya pasó.
  it("leaves only the descriptive fields on a settled loan", () => {
    const fields = editableFields("PAID");
    expect(fields).toEqual([...DESCRIPTIVE_FIELDS]);
    for (const field of FINANCIAL_FIELDS) {
      expect(fields, field).not.toContain(field);
    }
  });

  it("gives nothing on a closed loan", () => {
    expect(editableFields("CANCELLED")).toEqual([]);
    expect(editableFields("WRITTEN_OFF")).toEqual([]);
  });

  it("never lets a closed loan expose the money", () => {
    for (const status of ALL_STATUSES) {
      if (!["PAID", "CANCELLED", "WRITTEN_OFF"].includes(status)) continue;
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

describe("lockedReasonKey", () => {
  it("explains why, so the screen can tell the user", () => {
    expect(lockedReasonKey("DRAFT")).toBeNull();
    expect(lockedReasonKey("ACTIVE")).toBeNull();
    expect(lockedReasonKey("PAID")).toBe("loans.editLockedPaid");
    expect(lockedReasonKey("CANCELLED")).toBe("loans.editLockedClosed");
  });
});
