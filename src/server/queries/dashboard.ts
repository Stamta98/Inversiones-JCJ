/**
 * Dashboard aggregates.
 */

import { todayIn } from "@/core/dates";

import { db } from "../db";

export interface DashboardSummary {
  portfolio: number;
  collectedToday: number;
  expectedToday: number;
  overdueAmount: number;
  overdueCustomers: number;
  activeLoans: number;
  cashOnHand: number;
  newCustomersThisMonth: number;
}

export interface DueTodayRow {
  installmentId: string;
  loanId: string;
  loanCode: string;
  customerName: string;
  amount: number;
  paid: number;
}

export interface ArrearsRow {
  loanId: string;
  loanCode: string;
  customerName: string;
  customerPhone: string | null;
  daysInArrears: number;
  outstanding: number;
}

export interface RecentPaymentRow {
  id: string;
  receiptNumber: string;
  customerName: string;
  amount: number;
  paidAt: Date;
  /**
   * Cuándo se registró de verdad. `paidAt` es el día que la persona escogió,
   * guardado al mediodía UTC: enseñado con hora decía «12:00» en todos los
   * cobros que se han hecho, que no es la hora de ninguno.
   */
  createdAt: Date;
}

/**
 * El día de la empresa, no el del servidor.
 *
 * En Vercel el servidor vive en UTC: con `startOfDay` el día del tablero
 * cambiaba a las siete de la noche en Colombia, y lo cobrado después de esa
 * hora aparecía como de mañana.
 */
function dayBounds(timeZone: string): { start: Date; end: Date } {
  // El día se escoge donde está la empresa, pero se mide en horas UTC a
  // propósito: aquí se filtran columnas que guardan un día y no un instante
  // —el vencimiento de una cuota se ancla a la medianoche UTC de su fecha, y
  // el cobro al mediodía—, y correrles la ventana cinco horas dejaría fuera
  // las cuotas que vencen hoy.
  const start = todayIn(timeZone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getDashboardSummary(
  companyId: string,
  timeZone: string,
): Promise<DashboardSummary> {
  const { start, end } = dayBounds(timeZone);
  // El mes también sale del día de la empresa: el primero de mes empieza a
  // medianoche allá, no a las siete de la tarde del último día del mes.
  const monthStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );

  const [
    portfolio,
    collectedToday,
    expectedToday,
    arrears,
    activeLoans,
    cash,
    newCustomers,
  ] = await Promise.all([
    db.loan.aggregate({
      where: { companyId, status: { in: ["ACTIVE", "IN_ARREARS"] } },
      _sum: { outstanding: true },
    }),
    db.payment.aggregate({
      where: {
        companyId,
        status: "POSTED",
        paidAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
    db.loanInstallment.aggregate({
      where: {
        dueDate: { gte: start, lt: end },
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
        loan: { companyId, status: { in: ["ACTIVE", "IN_ARREARS"] } },
      },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    db.loan.findMany({
      where: { companyId, status: "IN_ARREARS" },
      select: { customerId: true, outstanding: true },
    }),
    db.loan.count({
      where: { companyId, status: { in: ["ACTIVE", "IN_ARREARS"] } },
    }),
    db.cashBox.aggregate({
      where: { companyId, isActive: true },
      _sum: { balance: true },
    }),
    db.customer.count({
      where: { companyId, createdAt: { gte: monthStart } },
    }),
  ]);

  return {
    portfolio: Number(portfolio._sum.outstanding ?? 0),
    collectedToday: Number(collectedToday._sum.amount ?? 0),
    expectedToday:
      Number(expectedToday._sum.totalAmount ?? 0) -
      Number(expectedToday._sum.paidAmount ?? 0),
    overdueAmount: arrears.reduce(
      (total, loan) => total + Number(loan.outstanding),
      0,
    ),
    overdueCustomers: new Set(arrears.map((loan) => loan.customerId)).size,
    activeLoans,
    cashOnHand: Number(cash._sum.balance ?? 0),
    newCustomersThisMonth: newCustomers,
  };
}

export async function getDueToday(
  companyId: string,
  timeZone: string,
  take = 8,
): Promise<DueTodayRow[]> {
  const { start, end } = dayBounds(timeZone);

  const rows = await db.loanInstallment.findMany({
    where: {
      dueDate: { gte: start, lt: end },
      status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
      loan: { companyId, status: { in: ["ACTIVE", "IN_ARREARS"] } },
    },
    include: {
      loan: { select: { id: true, code: true, customer: true } },
    },
    orderBy: { totalAmount: "desc" },
    take,
  });

  return rows.map((row) => ({
    installmentId: row.id,
    loanId: row.loan.id,
    loanCode: row.loan.code,
    customerName: `${row.loan.customer.firstName} ${row.loan.customer.lastName}`,
    amount: Number(row.totalAmount),
    paid: Number(row.paidAmount),
  }));
}

export async function getTopArrears(
  companyId: string,
  take = 8,
): Promise<ArrearsRow[]> {
  const loans = await db.loan.findMany({
    where: { companyId, status: "IN_ARREARS" },
    include: { customer: true },
    orderBy: [{ daysInArrears: "desc" }, { outstanding: "desc" }],
    take,
  });

  return loans.map((loan) => ({
    loanId: loan.id,
    loanCode: loan.code,
    customerName: `${loan.customer.firstName} ${loan.customer.lastName}`,
    customerPhone: loan.customer.mobilePhone ?? loan.customer.phone,
    daysInArrears: loan.daysInArrears,
    outstanding: Number(loan.outstanding),
  }));
}

export async function getRecentPayments(
  companyId: string,
  take = 8,
): Promise<RecentPaymentRow[]> {
  const payments = await db.payment.findMany({
    where: { companyId, status: "POSTED" },
    include: { loan: { select: { customer: true } } },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
  });

  return payments.map((payment) => ({
    id: payment.id,
    receiptNumber: payment.receiptNumber,
    customerName: `${payment.loan.customer.firstName} ${payment.loan.customer.lastName}`,
    amount: Number(payment.amount),
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  }));
}
