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
