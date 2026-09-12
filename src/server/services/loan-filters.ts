/**
 * Qué préstamos entran a la ruta del día, en un solo lugar.
 *
 * La lista y las flechas de la ficha preguntaban cada una por su lado: la
 * lista dejaba fuera los saldados y las flechas no, así que dándole
 * "siguiente" se caía en un préstamo que ya se había terminado de pagar y que
 * no estaba en la lista de la que se venía. Con un solo sitio ya no se pueden
 * volver a separar.
 */

import type { Prisma } from "@prisma/client";

/**
 * El atraso se pregunta por las cuotas, no por la columna `daysInArrears`.
 *
 * Esa columna la escribe el trabajo de la madrugada, así que entre las doce
 * de la noche y esa hora dice el atraso de ayer. Las tarjetas cuentan los
 * días al abrir la lista, y si el filtro mirara la columna diría que no hay
 * nadie en mora mientras las tarjetas muestran los días. Preguntando por la
 * fecha de las cuotas las dos cosas dicen lo mismo a cualquier hora.
 */
function unpaidBefore(date: Date): Prisma.LoanWhereInput {
  return {
    installments: {
      some: {
        dueDate: { lt: date },
        status: { notIn: ["PAID", "WAIVED"] },
      },
    },
  };
}

/**
 * Los filtros de la lista de préstamos.
 *
 * El saldado no está entre ellos: esta lista es de lo que hay por cobrar. Un
 * crédito pagado no se vuelve a visitar, y dejarlo aquí solo alarga la lista
 * que el cobrador baja con el pulgar todos los días. El que quiera verlo lo
 * tiene en el historial del cliente, con todo lo que le prestaron.
 */
export function buildLoanFilters(today: Date) {
  // De un anulado no se cobra, así que tampoco se atrasa por más cuotas sin
  // pagar que le queden colgando.
  const open: Prisma.LoanWhereInput = {
    status: { in: ["ACTIVE", "IN_ARREARS", "APPROVED"] },
  };
  // Al crédito le queda plazo mientras le quede alguna cuota por vencer.
  const stillRunning: Prisma.LoanWhereInput = {
    installments: { some: { dueDate: { gte: today } } },
  };
  return {
    all: { status: { not: "PAID" } } as Prisma.LoanWhereInput,
    onTime: {
      status: { in: ["ACTIVE", "APPROVED"] },
      NOT: unpaidBefore(today),
    },
    // Atrasado en cuotas pero con plazo por delante: todavía se arregla
    // cobrando. Vencido es que se acabó el plazo y sigue debiendo.
    late: { ...open, AND: [unpaidBefore(today), stillRunning] },
    expired: {
      ...open,
      AND: [
        { installments: { some: { status: { notIn: ["PAID", "WAIVED"] } } } },
        { NOT: stillRunning },
      ],
    },
  } satisfies Record<string, Prisma.LoanWhereInput>;
}

export type LoanFilterKey = keyof ReturnType<typeof buildLoanFilters>;

/**
 * Los que están en la ruta: los mismos que la lista enseña sin filtrar.
 *
 * Es por donde caminan las flechas de anterior y siguiente en la ficha del
 * préstamo, y por eso sale de aquí y no de una consulta suya.
 */
export function routeLoans(today: Date): Prisma.LoanWhereInput {
  return buildLoanFilters(today).all;
}
