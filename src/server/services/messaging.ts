/**
 * Messaging service.
 *
 * Two phases, deliberately separate:
 *   1. `queueScheduledMessages` decides what should be sent and writes it as
 *      QUEUED rows. It is idempotent thanks to the dedupe key.
 *   2. `dispatchQueue` takes those rows and hands them to the provider.
 *
 * Splitting them means a failed send never loses the decision, and the whole
 * plan can be previewed before a single message leaves the building.
 */

import { fromCents, toCents } from "@/core/money";
import {
  planScheduledMessages,
  type AutomationRuleInput,
  type LoanInput,
} from "@/modules/messaging/automation";
import { createProvider } from "@/modules/messaging/providers";
import { renderTemplate } from "@/modules/templates/render";
import { formatCurrency, formatDate } from "@/lib/format";

import { db } from "../db";

/** How many attempts a message gets before it is left as FAILED. */
const MAX_ATTEMPTS = 3;

/** Cap per run so one company cannot monopolise a dispatch cycle. */
const DISPATCH_BATCH_SIZE = 50;

export interface QueueResult {
  planned: number;
  queued: number;
}

export async function queueScheduledMessages(
  companyId: string,
  runDate: Date = new Date(),
): Promise<QueueResult> {
  const [rules, loans, company] = await Promise.all([
    db.automationRule.findMany({
      where: { companyId, isActive: true },
      include: { template: true },
    }),
    db.loan.findMany({
      where: { companyId, status: { in: ["ACTIVE", "IN_ARREARS"] } },
      include: {
        customer: true,
        installments: {
          where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
          orderBy: { number: "asc" },
        },
      },
    }),
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);

  if (rules.length === 0 || loans.length === 0) {
    return { planned: 0, queued: 0 };
  }

  const ruleInputs: AutomationRuleInput[] = rules.map((rule) => ({
    id: rule.id,
    trigger: rule.trigger,
    offsetDays: rule.offsetDays,
    templateId: rule.templateId,
    isActive: rule.isActive,
    conditions: (rule.conditions ?? {}) as AutomationRuleInput["conditions"],
  }));

  const loanInputs: LoanInput[] = loans.map((loan) => ({
    id: loan.id,
    customerId: loan.customerId,
    customerPhone: loan.customer.mobilePhone ?? loan.customer.phone,
    outstandingCents: toCents(Number(loan.outstanding)),
    daysInArrears: loan.daysInArrears,
    isCollectable: true,
    installments: loan.installments.map((installment) => ({
      id: installment.id,
      number: installment.number,
      dueDate: installment.dueDate,
      status: installment.status,
      principalCents: toCents(Number(installment.principalAmount)),
      interestCents: toCents(Number(installment.interestAmount)),
      lateFeeCents: toCents(Number(installment.lateFeeAmount)),
      paidCents: toCents(Number(installment.paidAmount)),
    })),
  }));

  const existing = await db.outboundMessage.findMany({
    where: { companyId, dedupeKey: { not: null } },
    select: { dedupeKey: true },
  });

  const planned = planScheduledMessages(loanInputs, ruleInputs, runDate, {
    existingDedupeKeys: new Set(
      existing
        .map((message) => message.dedupeKey)
        .filter((key): key is string => key !== null),
    ),
  });

  if (planned.length === 0) return { planned: 0, queued: 0 };

  const account = await db.messagingAccount.findFirst({
    where: { companyId, isActive: true },
    orderBy: { isDefault: "desc" },
  });

  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const money = (value: number) =>
    formatCurrency(value, company.currencyCode, `${company.locale}-DO`);

  let queued = 0;

  for (const message of planned) {
    const loan = loansById.get(message.loanId);
    const rule = rulesById.get(message.ruleId);
    if (!loan || !rule) continue;

    const installment = loan.installments.find(
      (candidate) => candidate.id === message.installmentId,
    );
    if (!installment) continue;

    const dueTotal =
      Number(installment.totalAmount) - Number(installment.paidAmount);

    const body = renderTemplate(
      rule.template.body,
      {
        company: { name: company.name, phone: company.phone ?? "" },
        customer: {
          firstName: loan.customer.firstName,
          lastName: loan.customer.lastName,
          fullName: `${loan.customer.firstName} ${loan.customer.lastName}`,
          code: loan.customer.code,
          mobilePhone: loan.customer.mobilePhone ?? "",
        },
        loan: {
          code: loan.code,
          principal: money(Number(loan.principal)),
          outstanding: money(Number(loan.outstanding)),
          daysInArrears: loan.daysInArrears,
          frequency: loan.frequency,
        },
        installment: {
          number: installment.number,
          dueDate: formatDate(installment.dueDate),
          amount: money(Number(installment.totalAmount)),
          lateFee: money(Number(installment.lateFeeAmount)),
          totalDue: money(dueTotal),
        },
        system: { today: formatDate(runDate) },
      },
      { fallback: "" },
    );

    try {
      await db.outboundMessage.create({
        data: {
          companyId,
          messagingAccountId: account?.id ?? null,
          customerId: message.customerId,
          loanId: message.loanId,
          templateId: message.templateId,
          automationRuleId: message.ruleId,
          channel: rule.channel,
          toAddress: message.toAddress,
          body,
          status: "QUEUED",
          dedupeKey: message.dedupeKey,
        },
      });
      queued += 1;
    } catch (error) {
      // A unique violation means a concurrent run already queued it.
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }

  await db.automationRule.updateMany({
    where: { id: { in: rules.map((rule) => rule.id) } },
    data: { lastRunAt: runDate },
  });

  return { planned: planned.length, queued };
}

export interface DispatchResult {
  attempted: number;
  sent: number;
  failed: number;
}

export async function dispatchQueue(
  companyId: string,
  limit = DISPATCH_BATCH_SIZE,
): Promise<DispatchResult> {
  const messages = await db.outboundMessage.findMany({
    where: {
      companyId,
      status: "QUEUED",
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    include: { messagingAccount: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const message of messages) {
    const account = message.messagingAccount;

    if (!account) {
      await db.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: "FAILED",
          failureReason: "No messaging account configured",
          attempts: { increment: 1 },
        },
      });
      failed += 1;
      continue;
    }

    let result;
    try {
      const provider = createProvider(
        account.provider,
        account.credentials as Record<string, unknown>,
      );
      result = await provider.send({
        to: message.toAddress,
        body: message.body,
        reference: message.id,
      });
    } catch (error) {
      result = {
        ok: false,
        failureReason:
          error instanceof Error ? error.message : "Provider error",
        retryable: false,
      };
    }

    if (result.ok) {
      await db.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          failureReason: null,
          attempts: { increment: 1 },
        },
      });
      sent += 1;
    } else {
      const nextAttempts = message.attempts + 1;
      const canRetry = result.retryable && nextAttempts < MAX_ATTEMPTS;
      await db.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: canRetry ? "QUEUED" : "FAILED",
          failureReason: result.failureReason ?? "Unknown error",
          attempts: nextAttempts,
        },
      });
      failed += 1;
    }
  }

  return { attempted: messages.length, sent, failed };
}

/** Queues one message by hand, e.g. from the call center screen. */
export async function queueManualMessage(input: {
  companyId: string;
  customerId: string;
  loanId?: string | null;
  templateId?: string | null;
  toAddress: string;
  body: string;
}): Promise<string> {
  const account = await db.messagingAccount.findFirst({
    where: { companyId: input.companyId, isActive: true },
    orderBy: { isDefault: "desc" },
  });

  const message = await db.outboundMessage.create({
    data: {
      companyId: input.companyId,
      messagingAccountId: account?.id ?? null,
      customerId: input.customerId,
      loanId: input.loanId ?? null,
      templateId: input.templateId ?? null,
      channel: "WHATSAPP",
      toAddress: input.toAddress,
      body: input.body,
      status: "QUEUED",
    },
  });

  return message.id;
}

export { fromCents };
