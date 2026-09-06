/**
 * El resumen del día, descargado.
 *
 * Se arma aquí y no en el navegador para que salga la misma hoja de un
 * teléfono, de un portátil y de donde se imprima después, y para que nadie
 * llegue al día de otra empresa adivinando una dirección.
 */

import { NextResponse } from "next/server";

import { dayParam, parseDay, startOfDay } from "@/core/dates";
import { hasPermission } from "@/core/permissions";
import { formatDate } from "@/lib/format";
import { getAuthContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { buildSummaryPdf } from "@/server/documents/summary-pdf";
import { loadDaySummary } from "@/server/services/day-summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(context.permissions, "payments.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dayStart =
    parseDay(searchParams.get("date") ?? undefined) ?? startOfDay(new Date());

  const [company, summary] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: { name: true, legalName: true, phone: true, city: true },
    }),
    loadDaySummary(context.companyId, dayStart),
  ]);

  const { t, money } = context;
  const day = formatDate(dayStart, context.locale);

  /** «1 abono» y no «1 abonos». */
  const count = (value: number, one: string, many: string) =>
    value === 0
      ? t("common.none")
      : value === 1
        ? t(one)
        : t(many).replace("{count}", String(value));

  const pdf = await buildSummaryPdf({
    company,
    day,
    tiles: [
      {
        label: t("payments.summary.collected"),
        amount: summary.collected,
        count: count(
          summary.paymentCount,
          "payments.summary.countPaymentsOne",
          "payments.summary.countPayments",
        ),
      },
      {
        label: t("payments.summary.tileLoans"),
        amount: summary.freshAmount,
        count: count(
          summary.freshCount,
          "payments.summary.countLoansOne",
          "payments.summary.countLoans",
        ),
      },
      {
        label: t("loans.renewal.kindMenu.RENEWAL"),
        amount: summary.renewedHandedOut,
        count: count(
          summary.renewalCount,
          "payments.summary.countRenewalsOne",
          "payments.summary.countRenewals",
        ),
      },
      {
        label: t("loans.renewal.kindMenu.REFINANCE"),
        amount: summary.refinancedAmount,
        count: count(
          summary.refinanceCount,
          "payments.summary.countRefinancesOne",
          "payments.summary.countRefinances",
        ),
      },
      {
        label: t("payments.summary.tileCharges"),
        amount: summary.chargesTaken,
        count: count(
          summary.chargesCount,
          "payments.summary.countChargesOne",
          "payments.summary.countCharges",
        ),
      },
      {
        label: t("payments.summary.expenses"),
        amount: summary.spent,
        count: count(
          summary.expenseCount,
          "payments.summary.countExpensesOne",
          "payments.summary.countExpenses",
        ),
      },
    ],
    handOver: {
      label: t("payments.summary.handOver"),
      amount: summary.handOver,
      hint: t("payments.summary.handOverHint"),
    },
    income: {
      title: t("payments.summary.income"),
      rows: [
        { label: t("loans.principalPart"), amount: summary.principalPaid },
        { label: t("loans.interestPart"), amount: summary.interestPaid },
        { label: t("loans.lateFeePart"), amount: summary.lateFeePaid },
        {
          label: t("loans.charges.installmentPart"),
          amount: summary.chargePaid,
        },
        // Lo que se pagó de más no entró a ninguna cuota; sin este renglón
        // las cuatro de arriba no suman lo cobrado.
        ...(summary.surplus > 0
          ? [{ label: t("payments.unapplied"), amount: summary.surplus }]
          : []),
      ].filter((row) => row.amount > 0),
    },
    movement: {
      title: t("payments.summary.movement"),
      rows: [
        { label: t("payments.summary.lent"), amount: summary.lent },
        {
          label: t("payments.summary.chargesTaken"),
          amount: summary.chargesDeducted,
        },
        {
          label: t("payments.summary.chargesApartLine"),
          amount: summary.chargesApartTaken,
        },
        { label: t("payments.summary.expenses"), amount: summary.spent },
      ].filter((row) => row.amount > 0),
      profit: {
        label: t("payments.summary.profit"),
        amount: summary.profit,
      },
    },
    paidWith: {
      title: t("payments.summary.methods"),
      rows: summary.paidWith.map((row) => ({
        label: t(`payments.methodLabel.${row.method}`),
        amount: row.amount,
      })),
    },
    loans: {
      title: t("payments.summary.loansOfDay"),
      rows: summary.loans.map((loan) => ({
        name: loan.name,
        code: loan.code,
        kind:
          loan.origin === "REFINANCE"
            ? t("loans.renewal.kindMenu.REFINANCE")
            : loan.origin === "RENEWAL"
              ? t("loans.renewal.kindMenu.RENEWAL")
              : t("payments.summary.kindNew"),
        amount: loan.amount,
      })),
    },
    payments: {
      title: t("payments.title"),
      columns: {
        receipt: t("payments.receiptNumber"),
        customer: t("loans.customer"),
        code: t("loans.code"),
        method: t("payments.method"),
        amount: t("common.amount"),
      },
      rows: summary.payments.map((payment) => ({
        receipt: payment.receiptNumber,
        name: payment.name,
        code: payment.loanCode,
        method: t(`payments.methodLabel.${payment.method}`),
        amount: payment.amount,
        reversed: payment.status === "REVERSED",
      })),
    },
    money,
    labels: {
      title: t("payments.summary.pdfTitle"),
      footer: t("payments.summary.pdfFooter"),
      page: t("loans.documentPage"),
      empty: t("payments.summary.pdfNoPayments"),
    },
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="resumen-${dayParam(dayStart)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
