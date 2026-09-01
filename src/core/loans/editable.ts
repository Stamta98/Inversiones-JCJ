/**
 * What may still be changed on a loan.
 *
 * Once money has moved, the financial terms are history: the installments were
 * generated from them, payments were allocated against those installments, and
 * the arrears were computed from those due dates. Editing the principal or the
 * rate at that point would silently rewrite what the customer already paid.
 *
 * So the terms are only editable while the loan is still a draft. After that
 * the correct move is to cancel the loan and issue a new one, which leaves a
 * trail instead of quietly changing the past.
 */

import type { LoanStatus } from "../types";

/** Fields that define the money: principal, rate, term, dates, late fee. */
export const FINANCIAL_FIELDS = [
  "principal",
  "interestRate",
  "interestMethod",
  "frequency",
  "customIntervalDays",
  "nonCollectionDays",
  "termCount",
  "firstDueDate",
  "lateFeeMode",
  "lateFeeValue",
  "gracePeriodDays",
] as const;

/** Fields that never affect a balance and stay editable for the whole life. */
export const DESCRIPTIVE_FIELDS = ["notes", "branchId"] as const;

export type FinancialField = (typeof FINANCIAL_FIELDS)[number];
export type DescriptiveField = (typeof DESCRIPTIVE_FIELDS)[number];

/** A loan whose schedule has not been committed to yet. */
export function canEditTerms(status: LoanStatus): boolean {
  return status === "DRAFT" || status === "PENDING_APPROVAL";
}

/** A closed loan is a record; not even the notes should move. */
export function canEditAtAll(status: LoanStatus): boolean {
  return status !== "CANCELLED" && status !== "WRITTEN_OFF";
}

export function canCancel(status: LoanStatus): boolean {
  return status !== "PAID" && status !== "CANCELLED" && status !== "WRITTEN_OFF";
}

export type EditableField = FinancialField | DescriptiveField;

export function editableFields(status: LoanStatus): EditableField[] {
  if (!canEditAtAll(status)) return [];
  if (!canEditTerms(status)) return [...DESCRIPTIVE_FIELDS];
  return [...FINANCIAL_FIELDS, ...DESCRIPTIVE_FIELDS];
}

export function isEditable(status: LoanStatus, field: EditableField): boolean {
  return editableFields(status).includes(field);
}

/**
 * Why the terms are locked, as an i18n key the UI can render. Null when they
 * are not locked.
 */
export function lockedReasonKey(status: LoanStatus): string | null {
  if (!canEditAtAll(status)) return "loans.editLockedClosed";
  if (!canEditTerms(status)) return "loans.editLockedDisbursed";
  return null;
}
