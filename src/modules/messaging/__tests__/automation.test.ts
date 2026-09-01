import { describe, expect, it } from "vitest";

import { toCents } from "@/core/money";

import {
  isDueAtTime,
  planScheduledMessages,
  type AutomationRuleInput,
  type InstallmentInput,
  type LoanInput,
} from "../automation";

const runDate = new Date(Date.UTC(2026, 2, 15));

function installment(
  overrides: Partial<InstallmentInput> & { id: string; dueDate: Date },
): InstallmentInput {
  return {
    number: 1,
    status: "PENDING",
    principalCents: toCents(1000),
    interestCents: toCents(100),
    lateFeeCents: 0,
    paidCents: 0,
    ...overrides,
  };
}

function loan(overrides: Partial<LoanInput> = {}): LoanInput {
  return {
    id: "loan-1",
    customerId: "customer-1",
    customerPhone: "18095550123",
    outstandingCents: toCents(5000),
    daysInArrears: 0,
    isCollectable: true,
    installments: [],
    ...overrides,
  };
}

function rule(overrides: Partial<AutomationRuleInput> = {}): AutomationRuleInput {
  return {
    id: "rule-1",
    trigger: "AFTER_DUE_DATE",
    offsetDays: 3,
    templateId: "template-1",
    isActive: true,
    conditions: {},
    ...overrides,
  };
}

describe("planScheduledMessages / BEFORE_DUE_DATE", () => {
  it("targets the installment due exactly N days from now", () => {
    const planned = planScheduledMessages(
      [
        loan({
          installments: [
            installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 17)) }),
            installment({ id: "i2", dueDate: new Date(Date.UTC(2026, 2, 25)) }),
          ],
        }),
      ],
      [rule({ trigger: "BEFORE_DUE_DATE", offsetDays: 2 })],
      runDate,
    );

    expect(planned).toHaveLength(1);
    expect(planned[0].installmentId).toBe("i1");
    expect(planned[0].daysFromDueDate).toBe(-2);
  });

  it("stays quiet when no installment matches the offset", () => {
    const planned = planScheduledMessages(
      [
        loan({
          installments: [
            installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 20)) }),
          ],
        }),
      ],
      [rule({ trigger: "BEFORE_DUE_DATE", offsetDays: 2 })],
      runDate,
    );
    expect(planned).toEqual([]);
  });
});

describe("planScheduledMessages / ON_DUE_DATE", () => {
  it("fires on the day the installment falls due", () => {
    const planned = planScheduledMessages(
      [
        loan({
          installments: [installment({ id: "i1", dueDate: runDate })],
        }),
      ],
      [rule({ trigger: "ON_DUE_DATE", offsetDays: 0 })],
      runDate,
    );
    expect(planned.map((m) => m.installmentId)).toEqual(["i1"]);
  });
});

describe("planScheduledMessages / AFTER_DUE_DATE", () => {
  it("chases an installment that is exactly N days late", () => {
    const planned = planScheduledMessages(
      [
        loan({
          daysInArrears: 3,
          installments: [
            installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 12)) }),
          ],
        }),
      ],
      [rule({ trigger: "AFTER_DUE_DATE", offsetDays: 3 })],
      runDate,
    );
    expect(planned).toHaveLength(1);
    expect(planned[0].daysFromDueDate).toBe(3);
  });

  it("ignores an installment that was already paid", () => {
    const planned = planScheduledMessages(
      [
        loan({
          installments: [
            installment({
              id: "i1",
              dueDate: new Date(Date.UTC(2026, 2, 12)),
              status: "PAID",
              paidCents: toCents(1100),
            }),
          ],
        }),
      ],
      [rule({ trigger: "AFTER_DUE_DATE", offsetDays: 3 })],
      runDate,
    );
    expect(planned).toEqual([]);
  });

  it("still chases a partially paid installment", () => {
    const planned = planScheduledMessages(
      [
        loan({
          installments: [
            installment({
              id: "i1",
              dueDate: new Date(Date.UTC(2026, 2, 12)),
              status: "PARTIALLY_PAID",
              paidCents: toCents(400),
            }),
          ],
        }),
      ],
      [rule({ trigger: "AFTER_DUE_DATE", offsetDays: 3 })],
      runDate,
    );
    expect(planned).toHaveLength(1);
  });
});

describe("planScheduledMessages / ARREARS_THRESHOLD", () => {
  it("fires once the loan crosses the configured arrears age", () => {
    const overdue = loan({
      daysInArrears: 15,
      installments: [
        installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 1)) }),
        installment({ id: "i2", dueDate: new Date(Date.UTC(2026, 2, 8)) }),
      ],
    });

    const planned = planScheduledMessages(
      [overdue],
      [rule({ trigger: "ARREARS_THRESHOLD", offsetDays: 10 })],
      runDate,
    );

    expect(planned).toHaveLength(1);
    expect(planned[0].installmentId).toBe("i1");
    expect(planned[0].daysFromDueDate).toBe(14);
  });

  it("does not fire below the threshold", () => {
    const planned = planScheduledMessages(
      [
        loan({
          daysInArrears: 4,
          installments: [
            installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 11)) }),
          ],
        }),
      ],
      [rule({ trigger: "ARREARS_THRESHOLD", offsetDays: 10 })],
      runDate,
    );
    expect(planned).toEqual([]);
  });
});

describe("planScheduledMessages / guards", () => {
  const overdueLoan = loan({
    daysInArrears: 3,
    installments: [
      installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 12)) }),
    ],
  });

  it("skips a customer with no phone number", () => {
    const planned = planScheduledMessages(
      [{ ...overdueLoan, customerPhone: null }],
      [rule()],
      runDate,
    );
    expect(planned).toEqual([]);
  });

  it("skips loans that are not collectable", () => {
    const planned = planScheduledMessages(
      [{ ...overdueLoan, isCollectable: false }],
      [rule()],
      runDate,
    );
    expect(planned).toEqual([]);
  });

  it("skips inactive rules", () => {
    const planned = planScheduledMessages(
      [overdueLoan],
      [rule({ isActive: false })],
      runDate,
    );
    expect(planned).toEqual([]);
  });

  it("ignores event triggers, which the job does not evaluate", () => {
    const planned = planScheduledMessages(
      [overdueLoan],
      [rule({ trigger: "ON_PAYMENT_POSTED" })],
      runDate,
    );
    expect(planned).toEqual([]);
  });

  it("honours the minimum outstanding condition", () => {
    const planned = planScheduledMessages(
      [{ ...overdueLoan, outstandingCents: toCents(100) }],
      [rule({ conditions: { minOutstandingCents: toCents(500) } })],
      runDate,
    );
    expect(planned).toEqual([]);
  });

  it("honours the arrears window", () => {
    const tooOld = { ...overdueLoan, daysInArrears: 90 };
    const planned = planScheduledMessages(
      [tooOld],
      [rule({ conditions: { maxDaysInArrears: 30 } })],
      runDate,
    );
    expect(planned).toEqual([]);
  });
});

describe("planScheduledMessages / deduplication", () => {
  const overdueLoan = loan({
    daysInArrears: 3,
    installments: [
      installment({ id: "i1", dueDate: new Date(Date.UTC(2026, 2, 12)) }),
    ],
  });

  it("builds a stable key per rule, installment and day", () => {
    const [message] = planScheduledMessages([overdueLoan], [rule()], runDate);
    expect(message.dedupeKey).toBe("rule:rule-1:installment:i1:2026-03-15");
  });

  it("does not re-plan a message already in the database", () => {
    const planned = planScheduledMessages(
      [overdueLoan],
      [rule()],
      runDate,
      {
        existingDedupeKeys: new Set([
          "rule:rule-1:installment:i1:2026-03-15",
        ]),
      },
    );
    expect(planned).toEqual([]);
  });

  it("lets two different rules both fire on the same installment", () => {
    const planned = planScheduledMessages(
      [overdueLoan],
      [
        rule({ id: "rule-a", trigger: "AFTER_DUE_DATE", offsetDays: 3 }),
        rule({ id: "rule-b", trigger: "ARREARS_THRESHOLD", offsetDays: 1 }),
      ],
      runDate,
    );
    expect(planned).toHaveLength(2);
    expect(new Set(planned.map((m) => m.dedupeKey)).size).toBe(2);
  });
});

describe("isDueAtTime", () => {
  it("only runs once the configured hour has arrived", () => {
    expect(isDueAtTime("09:00", 8, 59)).toBe(false);
    expect(isDueAtTime("09:00", 9, 0)).toBe(true);
    expect(isDueAtTime("09:30", 9, 15)).toBe(false);
    expect(isDueAtTime("09:30", 11, 0)).toBe(true);
  });

  it("rejects a malformed time", () => {
    expect(isDueAtTime("mañana", 10, 0)).toBe(false);
  });
});
