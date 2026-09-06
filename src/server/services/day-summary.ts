/**
 * Las cuentas de un día, en un solo lugar.
 *
 * La pantalla del resumen y el PDF que se comparte dicen las mismas cifras, y
 * la única manera de que sigan diciéndolas es que salgan de aquí. Cuando cada
 * una las sacaba por su lado, el cuadro de arriba y el total de abajo no
 * cuadraban: uno leía los préstamos del día y el otro la caja.
 *
 * Devuelve números pelados — sin moneda, sin idioma — porque el PDF y la
 * pantalla los visten distinto.
 */

import { addDays } from "@/core/dates";
import { db } from "@/server/db";

export interface DayLoan {
  id: string;
  code: string;
  name: string;
  origin: "NEW" | "RENEWAL" | "REFINANCE";
  /** Lo que significó en plata: prestado, entregado encima o trasladado. */
  amount: number;
}

export interface DayPayment {
  id: string;
  receiptNumber: string;
  loanId: string;
  loanCode: string;
  name: string;
  paidAt: Date;
  method: string;
  status: string;
  amount: number;
}

export interface DaySummary {
  dayStart: Date;
  /** Lo que entró por abonos, sin contar el traspaso de una refinanciación. */
  collected: number;
  paymentCount: number;
  principalPaid: number;
  interestPaid: number;
  lateFeePaid: number;
  chargePaid: number;
  /** Lo que se pagó de más y no entró a ninguna cuota. */
  surplus: number;
  /** Lo que de verdad salió del bolsillo: préstamos nuevos y lo entregado
   *  encima en una renovación. Una refinanciación no entrega nada. */
  lent: number;
  freshAmount: number;
  freshCount: number;
  renewedHandedOut: number;
  renewalCount: number;
  refinancedAmount: number;
  refinanceCount: number;
  /** Cargos que entraron por fuera del abono. */
  chargesTaken: number;
  chargesDeducted: number;
  chargesApartTaken: number;
  chargesCount: number;
  spent: number;
  expenseCount: number;
  /** Lo que el cobrador tiene que entregar al final del día. */
  handOver: number;
  /** Lo que dejó el día: el capital vuelve, no se gana. */
  profit: number;
  loans: DayLoan[];
  loanCount: number;
  paidWith: Array<{ method: string; amount: number }>;
  payments: DayPayment[];
  /** Un día sin nada: ni cobros, ni préstamos, ni gastos. */
  quiet: boolean;
}

export async function loadDaySummary(
  companyId: string,
  dayStart: Date,
): Promise<DaySummary> {
  // "Hoy" tiene dos extremos. Con solo el de abajo, un cobro o un préstamo
  // fechado adelante entraba en la cuenta del día y la inflaba.
  const day = { gte: dayStart, lt: addDays(dayStart, 1) };

  // Un traspaso de refinanciación se guarda como cobro para saldar el préstamo
  // viejo, pero esa plata nunca entró a la caja: contarla en el día sería
  // pedirle al cobrador que entregue lo que nadie le dio.
  const collectedToday = {
    companyId,
    status: "POSTED" as const,
    method: { not: "REFINANCE" as const },
    paidAt: day,
  };

  const [
    payments,
    todayTotal,
    applied,
    byMethod,
    chargesAtDisbursement,
    chargesApart,
    expenses,
    newLoans,
    carried,
  ] = await Promise.all([
    db.payment.findMany({
      where: { companyId, paidAt: day },
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        method: true,
        status: true,
        paidAt: true,
        loanId: true,
        loan: {
          select: {
            code: true,
            customer: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    db.payment.aggregate({
      where: collectedToday,
      _sum: { amount: true },
      _count: true,
    }),
    // A qué se le abonó lo que entró: capital, interés, mora y cargos.
    db.paymentAllocation.aggregate({
      where: { payment: collectedToday },
      _sum: {
        principalAmount: true,
        interestAmount: true,
        chargeAmount: true,
        lateFeeAmount: true,
      },
    }),
    db.payment.groupBy({
      by: ["method"],
      where: collectedToday,
      _sum: { amount: true },
    }),
    // El cargo que se le descontó a un préstamo viejo después de entregado:
    // esa plata entró hoy aunque el préstamo sea de otro día. El del préstamo
    // que se entregó hoy no se cuenta aquí — se lee del préstamo mismo, más
    // abajo — o se contaría dos veces.
    db.cashMovement.aggregate({
      where: {
        cashBox: { companyId },
        kind: "CHARGE_COLLECTED",
        createdAt: day,
        // Sin nombre: es el que se netea al entregar la plata. El que se le
        // cobró al cliente aparte lleva nombre y va en su propio renglón —
        // juntos, el renglón decía «al entregar» de plata que no fue así.
        chargeName: null,
        NOT: { loan: { disbursedAt: day } },
      },
      _sum: { amount: true },
      _count: true,
    }),
    // El cargo que se le cobró al cliente aparte de la cuota, en la puerta.
    db.cashMovement.aggregate({
      where: {
        cashBox: { companyId },
        kind: "CHARGE_COLLECTED",
        createdAt: day,
        chargeName: { not: null },
      },
      _sum: { amount: true },
      _count: true,
    }),
    // El gasto se cuenta desde el gasto, no desde la caja: uno registrado sin
    // caja igual salió del bolsillo, y el detalle lo lista aunque el cuadro
    // dijera cero.
    db.expense.aggregate({
      where: { companyId, spentAt: day },
      _sum: { amount: true },
      _count: true,
    }),
    db.loan.findMany({
      where: { companyId, disbursedAt: day },
      select: {
        id: true,
        code: true,
        origin: true,
        principal: true,
        parentLoanId: true,
        customer: { select: { firstName: true, lastName: true } },
        // El cargo que se le descontó al entregarle la plata: salió con el
        // desembolso y volvió de una. Se lee del préstamo y no de la caja
        // porque un préstamo entregado sin caja igual se lo cobró.
        charges: { where: { mode: "DEDUCTED" }, select: { amount: true } },
      },
      orderBy: { disbursedAt: "desc" },
    }),
    // Lo que se trasladó de cada préstamo viejo al nuevo, para saber qué
    // parte de una renovación fue plata entregada y qué parte fue traspaso.
    db.payment.groupBy({
      by: ["loanId"],
      where: {
        companyId,
        status: "POSTED",
        method: "REFINANCE",
        paidAt: day,
      },
      _sum: { amount: true },
    }),
  ]);

  // Refinanciar no mueve plata: traslada un saldo. Renovar traslada el saldo
  // y entrega la diferencia. Ninguna de las dos es "prestar" lo que dice el
  // monto del préstamo nuevo.
  const carriedFor = new Map(
    carried.map((row) => [row.loanId, Number(row._sum.amount ?? 0)]),
  );
  const carriedOn = (parentLoanId: string | null) =>
    parentLoanId ? (carriedFor.get(parentLoanId) ?? 0) : 0;

  const fresh = newLoans.filter((loan) => loan.origin === "NEW");
  const freshAmount = fresh.reduce(
    (total, loan) => total + Number(loan.principal),
    0,
  );
  const refinances = newLoans.filter((loan) => loan.origin === "REFINANCE");
  const renewals = newLoans.filter((loan) => loan.origin === "RENEWAL");
  const refinancedAmount = refinances.reduce(
    (total, loan) => total + carriedOn(loan.parentLoanId),
    0,
  );
  const renewedHandedOut = renewals.reduce(
    (total, loan) =>
      total +
      Math.max(0, Number(loan.principal) - carriedOn(loan.parentLoanId)),
    0,
  );

  const collected = Number(todayTotal._sum.amount ?? 0);
  // Lo prestado se cuenta desde los préstamos, no desde la caja, igual que el
  // gasto: uno entregado sin caja escogida igual salió del bolsillo, y la caja
  // no se enteraba.
  const lent = freshAmount + renewedHandedOut;
  // Lo que se le descontó al cliente al entregarle: salió con el desembolso y
  // volvió de una, así que es plata que se quedó en la caja. Del préstamo de
  // hoy se lee en el préstamo; de uno viejo al que le cambiaron el cargo
  // después, en el movimiento que lo anotó.
  const chargesOnNewLoans = newLoans.reduce(
    (total, loan) =>
      total +
      loan.charges.reduce((sum, charge) => sum + Number(charge.amount), 0),
    0,
  );
  const chargesDeducted =
    chargesOnNewLoans +
    Math.abs(Number(chargesAtDisbursement._sum.amount ?? 0));
  // Y lo que se le cobró aparte, que también entró a la caja pero por otra
  // puerta: se suma igual, se muestra aparte.
  const chargesApartTaken = Math.abs(Number(chargesApart._sum.amount ?? 0));
  const chargesTaken = chargesDeducted + chargesApartTaken;
  const spent = Math.abs(Number(expenses._sum.amount ?? 0));

  const principalPaid = Number(applied._sum.principalAmount ?? 0);
  const interestPaid = Number(applied._sum.interestAmount ?? 0);
  const lateFeePaid = Number(applied._sum.lateFeeAmount ?? 0);
  const chargePaid = Number(applied._sum.chargeAmount ?? 0);

  return {
    dayStart,
    collected,
    paymentCount: todayTotal._count,
    principalPaid,
    interestPaid,
    lateFeePaid,
    chargePaid,
    // Cuando alguien paga más de lo que debía, ese sobrante no entró a ninguna
    // cuota. Sin él las cuatro de arriba no suman el total y la cuenta del día
    // parece cuadrada cuando no lo está.
    surplus:
      collected - (principalPaid + interestPaid + lateFeePaid + chargePaid),
    lent,
    freshAmount,
    freshCount: fresh.length,
    renewedHandedOut,
    renewalCount: renewals.length,
    refinancedAmount,
    refinanceCount: refinances.length,
    chargesTaken,
    chargesDeducted,
    chargesApartTaken,
    // El cargo que se repartió entre las cuotas no se cuenta aquí: entró
    // dentro del abono y ya está en lo cobrado.
    chargesCount:
      newLoans.filter((loan) => loan.charges.length > 0).length +
      chargesAtDisbursement._count +
      chargesApart._count,
    spent,
    expenseCount: expenses._count,
    handOver: collected + chargesTaken - lent - spent,
    // Lo que deja el día: el capital vuelve, no se gana. Los gastos sí salen.
    profit: interestPaid + lateFeePaid + chargePaid + chargesTaken - spent,
    loans: newLoans.map((loan) => {
      const moved = carriedOn(loan.parentLoanId);
      return {
        id: loan.id,
        code: loan.code,
        name: `${loan.customer.firstName} ${loan.customer.lastName}`,
        origin: loan.origin as DayLoan["origin"],
        amount:
          loan.origin === "REFINANCE"
            ? moved
            : loan.origin === "RENEWAL"
              ? Math.max(0, Number(loan.principal) - moved)
              : Number(loan.principal),
      };
    }),
    loanCount: newLoans.length,
    paidWith: byMethod
      .map((row) => ({
        method: row.method as string,
        amount: Number(row._sum.amount ?? 0),
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    payments: payments.map((payment) => ({
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      loanId: payment.loanId,
      loanCode: payment.loan.code,
      name: `${payment.loan.customer.firstName} ${payment.loan.customer.lastName}`,
      paidAt: payment.paidAt,
      method: payment.method as string,
      status: payment.status as string,
      amount: Number(payment.amount),
    })),
    quiet:
      collected === 0 && lent === 0 && spent === 0 && newLoans.length === 0,
  };
}
