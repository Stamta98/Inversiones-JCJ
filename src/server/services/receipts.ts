/**
 * Receipt data.
 *
 * One place that knows what a receipt says, so the screen, the image that goes
 * out over WhatsApp and anything printed later cannot disagree about how much
 * a customer paid.
 */

import { installmentsCovered, maskDocument } from "@/core/loans/receipt";
import { toCents } from "@/core/money";

import { db } from "../db";

export interface Receipt {
  paymentId: string;
  receiptNumber: string;
  amount: number;
  paidAt: Date;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  company: {
    name: string;
    phone: string | null;
    city: string | null;
    currencyCode: string;
    locale: string;
    decimalPlaces: number;
  };
  customer: {
    fullName: string;
    document: string;
    address: string | null;
  };
  loan: {
    id: string;
    code: string;
    termCount: number;
    /** Installments the payments add up to, part ones included. */
    covered: number;
    outstanding: number;
    daysLate: number;
    lastDueDate: Date | null;
    nextDueDate: Date | null;
  };
  collectedBy: string | null;
}

/** Loads a receipt, refusing one that belongs to another company. */
export async function loadReceipt(
  companyId: string,
  paymentId: string,
): Promise<Receipt | null> {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, companyId },
    include: {
      company: true,
      loan: {
        include: {
          customer: true,
          installments: { orderBy: { number: "asc" } },
        },
      },
    },
  });
  if (!payment) return null;

  const loan = payment.loan;
  const totalToPay = Number(loan.totalPrincipal) + Number(loan.totalInterest);
  const covered = installmentsCovered(
    toCents(Number(loan.totalPaid)),
    toCents(totalToPay),
    loan.termCount,
  );

  const open = loan.installments.filter(
    (installment) => installment.status !== "PAID",
  );

  const collector = payment.collectedById
    ? await db.user.findUnique({
        where: { id: payment.collectedById },
        select: { fullName: true },
      })
    : null;

  return {
    paymentId: payment.id,
    receiptNumber: payment.receiptNumber,
    amount: Number(payment.amount),
    paidAt: payment.paidAt,
    method: payment.method,
    status: payment.status,
    reference: payment.reference,
    notes: payment.notes,
    company: {
      name: payment.company.name,
      phone: payment.company.phone,
      city: payment.company.city,
      currencyCode: payment.company.currencyCode,
      locale: payment.company.locale,
      decimalPlaces: payment.company.decimalPlaces,
    },
    customer: {
      fullName: `${loan.customer.firstName} ${loan.customer.lastName}`,
      document: maskDocument(loan.customer.documentNumber),
      address: loan.customer.address ?? loan.customer.neighborhood,
    },
    loan: {
      id: loan.id,
      code: loan.code,
      termCount: loan.termCount,
      covered,
      outstanding: Number(loan.outstanding),
      daysLate: loan.daysInArrears,
      lastDueDate: loan.installments.at(-1)?.dueDate ?? null,
      nextDueDate: open[0]?.dueDate ?? null,
    },
    collectedBy: collector?.fullName ?? null,
  };
}

export interface LoanPaperwork {
  company: {
    name: string;
    legalName: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
    currencyCode: string;
    locale: string;
    decimalPlaces: number;
  };
  customer: {
    fullName: string;
    document: string;
    address: string | null;
    phone: string | null;
  };
  loan: {
    code: string;
    principal: number;
    interest: number;
    totalToPay: number;
    installmentAmount: number;
    interestRate: number;
    rateBasis: string;
    interestMethod: string;
    frequency: string;
    termCount: number;
    status: string;
    disbursedAt: Date | null;
    firstDueDate: Date;
    lastDueDate: Date | null;
    /** NEW, REFINANCE or RENEWAL, and the loan this one replaced. */
    origin: string;
    parentCode: string | null;
  };
  installments: Array<{
    number: number;
    dueDate: Date;
    principal: number;
    interest: number;
    charge: number;
    lateFee: number;
    total: number;
    balanceAfter: number;
  }>;
}

/** Everything the loan's paperwork says, refusing another company's loan. */
export async function loadLoanPaperwork(
  companyId: string,
  loanId: string,
): Promise<LoanPaperwork | null> {
  const loan = await db.loan.findFirst({
    where: { id: loanId, companyId },
    include: {
      company: true,
      customer: true,
      installments: { orderBy: { number: "asc" } },
      parentLoan: { select: { code: true } },
    },
  });
  if (!loan) return null;

  const totalToPay = Number(loan.totalPrincipal) + Number(loan.totalInterest);
  let balance = totalToPay;

  const installments = loan.installments.map((installment) => {
    const total = Number(installment.totalAmount);
    balance -= total;
    return {
      number: installment.number,
      dueDate: installment.dueDate,
      principal: Number(installment.principalAmount),
      interest: Number(installment.interestAmount),
      charge: Number(installment.chargeAmount),
      lateFee: Number(installment.lateFeeAmount),
      total,
      // What is left to hand over after this one, which is the number a
      // customer follows down the page.
      balanceAfter: Math.max(0, Math.round(balance * 100) / 100),
    };
  });

  return {
    company: {
      name: loan.company.name,
      legalName: loan.company.legalName,
      phone: loan.company.phone,
      city: loan.company.city,
      address: loan.company.address,
      currencyCode: loan.company.currencyCode,
      locale: loan.company.locale,
      decimalPlaces: loan.company.decimalPlaces,
    },
    customer: {
      fullName: `${loan.customer.firstName} ${loan.customer.lastName}`,
      document: maskDocument(loan.customer.documentNumber),
      address: loan.customer.address ?? loan.customer.neighborhood,
      phone: loan.customer.mobilePhone ?? loan.customer.phone,
    },
    loan: {
      code: loan.code,
      principal: Number(loan.principal),
      interest: Number(loan.totalInterest),
      totalToPay,
      installmentAmount: installments[0]?.total ?? 0,
      interestRate: Number(loan.interestRate),
      rateBasis: loan.rateBasis,
      interestMethod: loan.interestMethod,
      frequency: loan.frequency,
      termCount: loan.termCount,
      status: loan.status,
      disbursedAt: loan.disbursedAt,
      firstDueDate: loan.firstDueDate,
      lastDueDate: loan.installments.at(-1)?.dueDate ?? null,
      origin: loan.origin,
      parentCode: loan.parentLoan?.code ?? null,
    },
    installments,
  };
}
