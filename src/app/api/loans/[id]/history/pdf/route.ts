/**
 * El historial de abonos de un préstamo, descargado.
 *
 * Sale del servidor y no del navegador para que la hoja sea la misma desde un
 * teléfono o un portátil, y para que nadie llegue al préstamo de otra empresa
 * adivinando una dirección.
 */

import { NextResponse } from "next/server";

import { dayIn } from "@/core/dates";
import { hasPermission } from "@/core/permissions";
import { formatDate, formatTime } from "@/lib/format";
import { getAuthContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { buildHistoryPdf } from "@/server/documents/history-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(context.permissions, "payments.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { t, money, locale, timezone } = context;

  const [loan, company, applied, chargesApart] = await Promise.all([
    db.loan.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        payments: {
          orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
          include: { allocations: true },
        },
      },
    }),
    db.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: { name: true, legalName: true, phone: true, city: true },
    }),
    db.paymentAllocation.aggregate({
      where: { payment: { loanId: id, status: "POSTED" } },
      _sum: {
        principalAmount: true,
        interestAmount: true,
        lateFeeAmount: true,
        chargeAmount: true,
      },
    }),
    db.cashMovement.findMany({
      where: {
        loanId: id,
        kind: "CHARGE_COLLECTED",
        chargeName: { not: null },
      },
      select: { id: true, amount: true, chargeName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!loan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = `${loan.customer.firstName} ${loan.customer.lastName}`;
  const chargesApartTotal = chargesApart.reduce(
    (total, charge) => total + Number(charge.amount),
    0,
  );

  // Los mismos recuadros que la pantalla, y por la misma razón: un renglón en
  // cero le hace creer al cliente que se le cobró algo que no se le cobró.
  const applyRows = [
    {
      label: t("loans.principalPart"),
      amount: Number(applied._sum.principalAmount ?? 0),
    },
    {
      label: t("loans.interestPart"),
      amount: Number(applied._sum.interestAmount ?? 0),
    },
    {
      label: t("loans.lateFeePart"),
      amount: Number(applied._sum.lateFeeAmount ?? 0),
    },
    {
      label: t("loans.charges.installmentPart"),
      amount: Number(applied._sum.chargeAmount ?? 0),
    },
    { label: t("payments.summary.chargeApart"), amount: chargesApartTotal },
  ].filter((row) => row.amount > 0);

  // El saldo que quedó después de cada abono. Se cuenta hacia atrás desde el
  // saldo de hoy: es la misma cuenta que hace la pantalla, y así las dos dicen
  // el mismo número en el mismo renglón.
  const posted = loan.payments.filter((payment) => payment.status === "POSTED");
  const paidAfter = new Map<string, number>();
  let running = Number(loan.outstanding);
  for (let index = posted.length - 1; index >= 0; index -= 1) {
    paidAfter.set(posted[index].id, running);
    running += Number(posted[index].amount);
  }

  const paymentRows = loan.payments.map((payment) => {
    const parts = payment.allocations.reduce(
      (split, allocation) => ({
        principal: split.principal + Number(allocation.principalAmount),
        interest: split.interest + Number(allocation.interestAmount),
        lateFee: split.lateFee + Number(allocation.lateFeeAmount),
        charge: split.charge + Number(allocation.chargeAmount),
      }),
      { principal: 0, interest: 0, lateFee: 0, charge: 0 },
    );

    return {
      at: payment.createdAt,
      date: formatDate(payment.paidAt, locale),
      time: formatTime(payment.createdAt, locale, timezone),
      concept: t(`payments.methodLabel.${payment.method}`),
      detail: [
        parts.principal > 0
          ? `${t("loans.principalPart")} ${money(parts.principal)}`
          : null,
        parts.interest > 0
          ? `${t("loans.interestPart")} ${money(parts.interest)}`
          : null,
        parts.lateFee > 0
          ? `${t("loans.lateFeePart")} ${money(parts.lateFee)}`
          : null,
        parts.charge > 0
          ? `${t("loans.charges.installmentPart")} ${money(parts.charge)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amount: Number(payment.amount),
      balance:
        payment.status === "POSTED"
          ? money(paidAfter.get(payment.id) ?? 0)
          : t(`payments.statusLabel.${payment.status}`),
      reversed: payment.status !== "POSTED",
    };
  });

  // Un cargo cobrado en la puerta va en el mismo historial y en su fecha, sin
  // saldo: no baja lo que se debe por las cuotas.
  const chargeRows = chargesApart.map((charge) => ({
    at: charge.createdAt,
    date: formatDate(dayIn(charge.createdAt, timezone), locale),
    time: formatTime(charge.createdAt, locale, timezone),
    concept: t("payments.conceptLabel.CHARGE"),
    detail: charge.chargeName ?? "",
    amount: Number(charge.amount),
    balance: "—",
    reversed: false,
  }));

  const rows = [...paymentRows, ...chargeRows]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, ...row }) => {
      void at;
      return row;
    });

  const pdf = await buildHistoryPdf({
    company,
    title: t("payments.historyDocTitle"),
    subject: t("payments.historyOf")
      .replace("{code}", loan.code)
      .replace("{name}", name),
    // Las tres cifras con las que el cliente lee el resto de la hoja.
    facts: [
      { label: t("loans.principal"), value: money(Number(loan.principal)) },
      { label: t("loans.alreadyPaid"), value: money(Number(loan.totalPaid)) },
      { label: t("loans.outstanding"), value: money(Number(loan.outstanding)) },
    ],
    applied: { title: t("payments.historyApplied"), rows: applyRows },
    columns: {
      date: t("payments.historyColumns.date"),
      concept: t("payments.historyColumns.concept"),
      amount: t("payments.historyColumns.amount"),
      balance: t("payments.historyColumns.balance"),
    },
    rows,
    empty: t("payments.historyNone"),
    money,
    pageLabel: (current, total) =>
      t("loans.documentPage")
        .replace("{current}", String(current))
        .replace("{total}", String(total)),
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="historial-${loan.code}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
