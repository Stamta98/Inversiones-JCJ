/**
 * The loan document, downloaded.
 *
 * Built here rather than in the browser so the same file comes out of a phone,
 * a laptop and whatever prints it later, and so nothing about another
 * company's loan can be reached by guessing a URL.
 */

import { NextResponse } from "next/server";

import { hasPermission } from "@/core/permissions";
import { t } from "@/i18n";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAuthContext } from "@/server/auth/context";
import { buildLoanPdf } from "@/server/documents/loan-pdf";
import { loadLoanPaperwork } from "@/server/services/receipts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(context.permissions, "loans.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const paperwork = await loadLoanPaperwork(context.companyId, id);
  if (!paperwork) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { company, loan } = paperwork;

  const pdf = await buildLoanPdf({
    company,
    customer: paperwork.customer,
    loan: {
      code: loan.code,
      principal: loan.principal,
      interest: loan.interest,
      totalToPay: loan.totalToPay,
      installmentAmount: loan.installmentAmount,
      interestRate: loan.interestRate,
      rateBasisLabel: t(`loans.rateBasisShort.${loan.rateBasis}`),
      methodLabel: t(`loans.method.${loan.interestMethod}`),
      frequencyLabel: t(`loans.frequencyLabel.${loan.frequency}`),
      termCount: loan.termCount,
      disbursedAt: loan.disbursedAt,
      firstDueDate: loan.firstDueDate,
      lastDueDate: loan.lastDueDate,
      statusLabel: t(`loans.status.${loan.status}`),
      originLabel:
        loan.origin === "NEW"
          ? null
          : t(`loans.renewal.originLabel.${loan.origin}`),
      parentCode: loan.parentCode,
    },
    installments: paperwork.installments,
    money: (amount) =>
      formatCurrency(
        amount,
        company.currencyCode,
        company.locale,
        company.decimalPlaces,
      ),
    day: (date) => formatDate(date, company.locale),
    labels: {
      title: t("loans.documentTitle"),
      principal: t("loans.principal"),
      interest: t("loans.totalInterest"),
      totalToPay: t("loans.totalToPay"),
      installment: t("loans.installment"),
      customer: t("loans.customer"),
      document: t("customers.documentNumber"),
      address: t("customers.address"),
      phone: t("customers.mobilePhone"),
      method: t("loans.interestMethod"),
      rate: t("loans.interestRate"),
      frequency: t("loans.frequency"),
      termCount: t("loans.termCount"),
      disbursedAt: t("loans.disbursedAt"),
      firstDueDate: t("loans.firstDueDate"),
      lastDueDate: t("payments.receiptLastDue"),
      status: t("common.status"),
      schedule: t("loans.schedule"),
      number: t("loans.columnNumber"),
      dueDate: t("loans.dueDate"),
      capital: t("loans.principalShare"),
      interestShort: t("loans.interestShare"),
      charge: t("loans.charges.installmentPart"),
      lateFee: t("loans.lateFee"),
      total: t("loans.installment"),
      balance: t("loans.columnBalance"),
      signCustomer: t("loans.signCustomer"),
      signCompany: t("loans.signCompany"),
      footer: t("loans.documentFooter"),
      page: t("loans.documentPage"),
    },
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${loan.code}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
