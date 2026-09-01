/**
 * Collection automation.
 *
 * Pure planning layer: given the open installments and the company's rules,
 * it decides which messages should exist today. Sending is a separate step, so
 * the decision can be unit tested and previewed before anything leaves.
 *
 * Every planned message carries a `dedupeKey` that is unique per rule, loan,
 * installment and target date. The database enforces uniqueness on it, so a
 * job that runs twice can never message a customer twice.
 */

import { daysBetween, startOfDay } from "@/core/dates";
import { clampToZero, type Cents } from "@/core/money";
import type { InstallmentStatus } from "@/core/types";

export type AutomationTrigger =
  | "BEFORE_DUE_DATE"
  | "ON_DUE_DATE"
  | "AFTER_DUE_DATE"
  | "ARREARS_THRESHOLD"
  | "ON_PAYMENT_POSTED"
  | "ON_LOAN_DISBURSED";

/** Triggers evaluated by the scheduled job rather than by an event. */
export const SCHEDULED_TRIGGERS: AutomationTrigger[] = [
  "BEFORE_DUE_DATE",
  "ON_DUE_DATE",
  "AFTER_DUE_DATE",
  "ARREARS_THRESHOLD",
];

export interface AutomationRuleInput {
  id: string;
  trigger: AutomationTrigger;
  offsetDays: number;
  templateId: string;
  isActive: boolean;
  conditions: {
    /** Skip loans owing less than this, in cents. */
    minOutstandingCents?: number;
    /** Only fire for loans at or above this arrears age. */
    minDaysInArrears?: number;
    /** Stop firing past this arrears age, so old debt moves to call center. */
    maxDaysInArrears?: number;
  };
}

export interface InstallmentInput {
  id: string;
  number: number;
  dueDate: Date;
  status: InstallmentStatus;
  principalCents: Cents;
  interestCents: Cents;
  lateFeeCents: Cents;
  paidCents: Cents;
}

export interface LoanInput {
  id: string;
  customerId: string;
  /** Destination for the message; a loan without one is skipped. */
  customerPhone: string | null;
  outstandingCents: Cents;
  daysInArrears: number;
  /** Only ACTIVE and IN_ARREARS loans are chased. */
  isCollectable: boolean;
  installments: InstallmentInput[];
}

export interface PlannedMessage {
  ruleId: string;
  templateId: string;
  loanId: string;
  customerId: string;
  installmentId: string;
  toAddress: string;
  dedupeKey: string;
  /** Why this message was planned, useful for the preview screen. */
  reason: AutomationTrigger;
  daysFromDueDate: number;
}

function installmentOutstanding(installment: InstallmentInput): Cents {
  return clampToZero(
    installment.principalCents +
      installment.interestCents +
      installment.lateFeeCents -
      installment.paidCents,
  );
}

function isOpen(installment: InstallmentInput): boolean {
  return (
    installment.status !== "PAID" &&
    installment.status !== "WAIVED" &&
    installmentOutstanding(installment) > 0
  );
}

function passesConditions(loan: LoanInput, rule: AutomationRuleInput): boolean {
  const { conditions } = rule;
  if (
    conditions.minOutstandingCents !== undefined &&
    loan.outstandingCents < conditions.minOutstandingCents
  ) {
    return false;
  }
  if (
    conditions.minDaysInArrears !== undefined &&
    loan.daysInArrears < conditions.minDaysInArrears
  ) {
    return false;
  }
  if (
    conditions.maxDaysInArrears !== undefined &&
    loan.daysInArrears > conditions.maxDaysInArrears
  ) {
    return false;
  }
  return true;
}

function buildDedupeKey(
  rule: AutomationRuleInput,
  installmentId: string,
  runDate: Date,
): string {
  const day = startOfDay(runDate).toISOString().slice(0, 10);
  return `rule:${rule.id}:installment:${installmentId}:${day}`;
}

/**
 * Decides which installment of a loan a scheduled rule targets today.
 *
 * BEFORE_DUE_DATE / ON_DUE_DATE / AFTER_DUE_DATE all compare the run date
 * against a due date; ARREARS_THRESHOLD instead keys off the oldest open
 * installment once the loan crosses the configured age.
 */
function selectInstallment(
  loan: LoanInput,
  rule: AutomationRuleInput,
  runDate: Date,
): { installment: InstallmentInput; daysFromDueDate: number } | null {
  const open = loan.installments
    .filter(isOpen)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  if (open.length === 0) return null;

  const offset = Math.abs(rule.offsetDays);

  switch (rule.trigger) {
    case "BEFORE_DUE_DATE": {
      const match = open.find(
        (installment) => daysBetween(runDate, installment.dueDate) === offset,
      );
      return match ? { installment: match, daysFromDueDate: -offset } : null;
    }
    case "ON_DUE_DATE": {
      const match = open.find(
        (installment) => daysBetween(runDate, installment.dueDate) === 0,
      );
      return match ? { installment: match, daysFromDueDate: 0 } : null;
    }
    case "AFTER_DUE_DATE": {
      const match = open.find(
        (installment) => daysBetween(installment.dueDate, runDate) === offset,
      );
      return match ? { installment: match, daysFromDueDate: offset } : null;
    }
    case "ARREARS_THRESHOLD": {
      if (loan.daysInArrears < offset) return null;
      const oldest = open[0];
      return {
        installment: oldest,
        daysFromDueDate: daysBetween(oldest.dueDate, runDate),
      };
    }
    default:
      return null;
  }
}

export interface PlanOptions {
  /** Dedupe keys already present in the database, to avoid re-sending. */
  existingDedupeKeys?: ReadonlySet<string>;
}

/**
 * Builds the list of messages that should go out for a single run date.
 */
export function planScheduledMessages(
  loans: readonly LoanInput[],
  rules: readonly AutomationRuleInput[],
  runDate: Date = new Date(),
  options: PlanOptions = {},
): PlannedMessage[] {
  const today = startOfDay(runDate);
  const already = options.existingDedupeKeys ?? new Set<string>();
  const planned: PlannedMessage[] = [];
  const seen = new Set<string>();

  const activeRules = rules.filter(
    (rule) => rule.isActive && SCHEDULED_TRIGGERS.includes(rule.trigger),
  );

  for (const loan of loans) {
    if (!loan.isCollectable) continue;
    if (!loan.customerPhone) continue;

    for (const rule of activeRules) {
      if (!passesConditions(loan, rule)) continue;

      const selection = selectInstallment(loan, rule, today);
      if (!selection) continue;

      const dedupeKey = buildDedupeKey(rule, selection.installment.id, today);
      if (already.has(dedupeKey) || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      planned.push({
        ruleId: rule.id,
        templateId: rule.templateId,
        loanId: loan.id,
        customerId: loan.customerId,
        installmentId: selection.installment.id,
        toAddress: loan.customerPhone,
        dedupeKey,
        reason: rule.trigger,
        daysFromDueDate: selection.daysFromDueDate,
      });
    }
  }

  return planned;
}

/** Whether a rule should run at this local time, given "HH:mm". */
export function isDueAtTime(
  sendAtTime: string,
  currentHour: number,
  currentMinute: number,
): boolean {
  const [hourText, minuteText] = sendAtTime.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  return (
    currentHour > hour || (currentHour === hour && currentMinute >= minute)
  );
}
