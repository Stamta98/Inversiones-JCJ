/**
 * Correr el plan de los préstamos que cobran el día de la entrega.
 *
 * El día en que se entrega la plata no se cobra: la primera cuota cae un
 * período después. Los préstamos hechos antes de esa regla arrancan el mismo
 * día, y por eso se acaban un período antes de lo que dice la cuenta de
 * cabeza — treinta cuotas diarias entregadas el 11 de agosto terminan el 9 de
 * septiembre en vez del 10.
 *
 * Aquí vive quién está torcido y cómo se endereza, en un solo sitio, para que
 * el préstamo suelto y la corrección de todos hagan exactamente lo mismo.
 */

import { dayIn, firstDueAfter } from "@/core/dates";
import { canEditAtAll } from "@/core/loans/editable";
import type { LoanStatus, PaymentFrequency } from "@/core/types";

import { db } from "../db";
import { updateLoan } from "./loans";

/** Un préstamo que arranca el día en que salió la plata. */
export interface CrookedLoan {
  id: string;
  code: string;
}

/**
 * Lo que hay que saber de un préstamo para decidir si está torcido.
 *
 * Se pide aparte y no dentro de la consulta porque la comparación no es de
 * base de datos: la entrega es una hora en UTC y la cuota es un día suelto, y
 * juntarlas pide bajar la primera al día de la oficina.
 */
type Candidate = {
  id: string;
  code: string;
  status: string;
  disbursedAt: Date | null;
  installments: { dueDate: Date }[];
};

/**
 * Si su primera cuota cae justo el día en que se entregó la plata.
 *
 * Justo ese día, ni antes. Una cuota anterior a la entrega no es un error de
 * la regla vieja sino un préstamo que ya venía andando en la calle cuando se
 * digitó: la fecha de entrega es el día en que se pasó a la aplicación y las
 * cuotas son de antes. Correrle el plan a ese le movería las fechas de verdad
 * hasta después de haberlo digitado, que es justo lo contrario de arreglarlo.
 */
export function chargesOnDeliveryDay(
  loan: Pick<Candidate, "status" | "disbursedAt" | "installments">,
  timeZone: string,
): boolean {
  if (!loan.disbursedAt) return false;
  if (!canEditAtAll(loan.status as LoanStatus)) return false;
  const first = loan.installments[0]?.dueDate;
  if (!first) return false;
  return (
    dayIn(first, "UTC").getTime() === dayIn(loan.disbursedAt, timeZone).getTime()
  );
}

/** Los préstamos de la empresa que todavía cobran el día de la entrega. */
export async function crookedLoans(
  companyId: string,
  timeZone: string,
): Promise<CrookedLoan[]> {
  const loans = await db.loan.findMany({
    where: {
      companyId,
      disbursedAt: { not: null },
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "IN_ARREARS"] },
    },
    select: {
      id: true,
      code: true,
      status: true,
      disbursedAt: true,
      installments: {
        orderBy: { dueDate: "asc" },
        take: 1,
        select: { dueDate: true },
      },
    },
    orderBy: { code: "asc" },
  });

  return loans
    .filter((loan) => chargesOnDeliveryDay(loan, timeZone))
    .map((loan) => ({ id: loan.id, code: loan.code }));
}

/**
 * Endereza un préstamo: la primera cuota pasa a un período después de la
 * entrega y con ella se corre el plan entero.
 *
 * Va por `updateLoan` y no por una escritura a mano para que el plan se rehaga
 * como se rehace siempre y lo ya cobrado se vuelva a repartir sobre él.
 *
 * Devuelve si lo tocó: entre que se cuenta y que alguien toca el botón, un
 * préstamo pudo quedar saldado o arreglado por otro lado, y en ese caso se
 * pasa de largo en vez de rehacerle el plan sin motivo.
 */
export async function fixFirstDue(
  companyId: string,
  loanId: string,
  timeZone: string,
  decimalPlaces: number,
  userId: string | null,
): Promise<boolean> {
  const loan = await db.loan.findFirst({
    where: { id: loanId, companyId },
    select: {
      id: true,
      status: true,
      disbursedAt: true,
      principal: true,
      interestRate: true,
      rateBasis: true,
      interestMethod: true,
      frequency: true,
      customIntervalDays: true,
      nonCollectionDays: true,
      termCount: true,
      lateFeeMode: true,
      lateFeeValue: true,
      gracePeriodDays: true,
      installments: {
        orderBy: { dueDate: "asc" },
        take: 1,
        select: { dueDate: true },
      },
    },
  });
  if (!loan || !loan.disbursedAt) return false;
  if (!chargesOnDeliveryDay(loan, timeZone)) return false;

  await updateLoan({
    companyId,
    loanId: loan.id,
    terms: {
      principal: Number(loan.principal),
      interestRate: Number(loan.interestRate),
      rateBasis: loan.rateBasis as never,
      interestMethod: loan.interestMethod as never,
      frequency: loan.frequency as never,
      customIntervalDays: loan.customIntervalDays,
      nonCollectionDays: loan.nonCollectionDays,
      termCount: loan.termCount,
      firstDueDate: firstDueAfter(
        loan.disbursedAt,
        loan.frequency as PaymentFrequency,
        {
          customIntervalDays: loan.customIntervalDays ?? undefined,
          nonCollectionDays: loan.nonCollectionDays,
        },
      ),
      lateFeeMode: loan.lateFeeMode as never,
      lateFeeValue: Number(loan.lateFeeValue),
      gracePeriodDays: loan.gracePeriodDays,
      decimalPlaces,
    },
    updatedById: userId,
  });
  return true;
}

/**
 * Endereza todos los que estén torcidos, uno por uno.
 *
 * Uno por uno y no en una sola escritura: cada préstamo rehace su plan y
 * vuelve a repartir sus cobros, y eso no se puede hacer con un UPDATE. Si uno
 * falla —quedó cerrado en el camino, o tiene algo raro— se anota y se sigue
 * con los demás, que es mejor que dejar a medias los que sí se podían.
 */
export async function fixAllFirstDue(
  companyId: string,
  timeZone: string,
  decimalPlaces: number,
  userId: string | null,
): Promise<{ fixed: number; failed: string[] }> {
  const pending = await crookedLoans(companyId, timeZone);
  let fixed = 0;
  const failed: string[] = [];

  for (const loan of pending) {
    try {
      if (await fixFirstDue(companyId, loan.id, timeZone, decimalPlaces, userId)) {
        fixed += 1;
      }
    } catch {
      failed.push(loan.code);
    }
  }

  return { fixed, failed };
}
