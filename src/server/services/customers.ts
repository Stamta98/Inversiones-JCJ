/**
 * Servicio de clientes.
 *
 * Por ahora solo lo que borra, que es lo único que necesita cuidado: crear y
 * editar viven en la acción del formulario, donde no hay nada que orquestar.
 */

import { db } from "../db";
import { deleteLoanWithin } from "./loans";

export class CustomerServiceError extends Error {
  constructor(
    message: string,
    readonly code: "notFound",
  ) {
    super(message);
    this.name = "CustomerServiceError";
  }
}

export interface CustomerDeletionSummary {
  loans: number;
  /** Lo que el cliente debe hoy y dejaría de deber. */
  outstanding: number;
  /** Lo que ya había pagado y desaparecería del historial. */
  paid: number;
}

/**
 * Qué se llevaría por delante borrar a este cliente.
 *
 * Se enseña antes de preguntar: borrar un cliente con préstamos activos borra
 * también lo que debe y lo que ya pagó, y eso no se adivina desde un botón.
 */
export async function customerDeletionSummary(
  companyId: string,
  customerId: string,
): Promise<CustomerDeletionSummary | null> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId },
    select: {
      loans: { select: { outstanding: true, totalPaid: true, status: true } },
    },
  });
  if (!customer) return null;

  const open = customer.loans.filter((loan) =>
    ["ACTIVE", "IN_ARREARS", "APPROVED"].includes(loan.status),
  );

  return {
    loans: customer.loans.length,
    outstanding: open.reduce(
      (total, loan) => total + Number(loan.outstanding),
      0,
    ),
    paid: customer.loans.reduce(
      (total, loan) => total + Number(loan.totalPaid),
      0,
    ),
  };
}

/**
 * Borra un cliente para siempre, con todo lo suyo.
 *
 * Sus préstamos se van uno a uno por la misma puerta que usa borrar un
 * préstamo, así que la caja queda igual que si nunca se les hubiera prestado:
 * vuelven los desembolsos y salen los cobros. Todo en una transacción — un
 * cliente a medio borrar, con préstamos huérfanos, sería peor que no borrarlo.
 *
 * Lo único que sobrevive es la auditoría, que es lo que hace que se pueda
 * borrar del todo sin perder el rastro de que se borró.
 */
export async function deleteCustomer(
  companyId: string,
  customerId: string,
  options: { userId?: string | null } = {},
): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId },
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          loans: { select: { id: true, code: true } },
        },
      });
      if (!customer) return;

      for (const loan of customer.loans) {
        // Un préstamo del cliente pudo refinanciar a otro del mismo cliente;
        // como se van todos, ese candado no aplica aquí.
        await deleteLoanWithin(tx, companyId, loan.id, {
          userId: options.userId ?? null,
          skipRenewalCheck: true,
        });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: options.userId ?? null,
          action: "customer.deleted",
          entityType: "Customer",
          entityId: customer.id,
          metadata: {
            code: customer.code,
            fullName: `${customer.firstName} ${customer.lastName}`,
            documentNumber: customer.documentNumber,
            loans: customer.loans.map((loan) => loan.code),
          },
        },
      });

      // Las referencias, los adjuntos, las visitas, las promesas y los
      // mensajes se van con él.
      await tx.customer.delete({ where: { id: customer.id } });
    },
    // Un cliente con muchos préstamos toca muchas filas; el tiempo por defecto
    // se queda corto y dejar la transacción a medias no es una opción.
    { timeout: 30_000 },
  );
}
