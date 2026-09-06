"use client";

import { useTransition } from "react";

import { es } from "@/i18n/es";

import { deleteCustomerAction } from "../actions";

/** Lo que se lleva por delante borrar a este cliente. */
export interface DeletionSummary {
  loans: number;
  outstanding: number;
  paid: number;
  /** Ya formateado: la moneda de la empresa se resuelve en el servidor. */
  money: { outstanding: string; paid: string };
}

/**
 * Borrar un cliente, se pida desde donde se pida.
 *
 * Vive aparte porque se hace desde dos sitios —los tres puntos de la ficha y
 * el cuadro de la pantalla de editar— y las dos tienen que avisar lo mismo.
 * Si el aviso viviera en cada botón, uno de los dos se quedaría atrás y
 * habría una puerta que borra sin decir qué se lleva.
 *
 * Se pregunta siempre. Esto no se deshace: se van el cliente, sus préstamos,
 * sus cuotas y sus recibos, y lo único que queda es el renglón de la
 * auditoría. Un dedo que resbala en el bolsillo no puede costar eso.
 */
export function useDeleteCustomer(
  customerId: string,
  summary: DeletionSummary,
) {
  const [pending, startTransition] = useTransition();

  const remove = () => {
    // Un cliente repetido creado por error y uno con plata afuera se borran
    // con el mismo botón: la diferencia hay que decirla aquí.
    const lines: string[] = [es.customers.deleteConfirm];
    if (summary.loans > 0) {
      lines.push(
        es.customers.deleteWithLoans.replace("{loans}", String(summary.loans)),
      );
      if (summary.outstanding > 0) {
        lines.push(
          es.customers.deleteOutstanding.replace(
            "{amount}",
            summary.money.outstanding,
          ),
        );
      }
      if (summary.paid > 0) {
        lines.push(
          es.customers.deletePaid.replace("{amount}", summary.money.paid),
        );
      }
    }
    if (!window.confirm(lines.join("\n\n"))) return;

    const formData = new FormData();
    formData.set("customerId", customerId);
    startTransition(async () => {
      await deleteCustomerAction(formData);
    });
  };

  return { remove, pending };
}
