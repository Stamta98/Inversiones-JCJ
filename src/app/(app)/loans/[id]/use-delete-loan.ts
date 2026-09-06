"use client";

import { useState, useTransition } from "react";

import { es } from "@/i18n/es";

import { deleteLoanAction } from "../actions";

/**
 * Borrar un préstamo, se pida desde donde se pida.
 *
 * Vive aparte porque se hace desde dos sitios —los tres puntos del préstamo y
 * el cuadro de la pantalla de editar— y las dos tienen que avisar lo mismo.
 * Si el aviso viviera en cada botón, uno de los dos se quedaría atrás y habría
 * una puerta que borra sin decir qué se lleva.
 *
 * Se pregunta siempre. Esto no se deshace: se van el préstamo, sus cuotas y
 * sus cobros, y la plata vuelve a la caja como si nunca se hubiera prestado.
 */
export function useDeleteLoan(loanId: string) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    if (!window.confirm(es.loans.deleteConfirm)) return;

    const formData = new FormData();
    formData.set("loanId", loanId);
    setError(null);
    startTransition(async () => {
      // Cuando sale bien la acción redirige y esto no vuelve; si vuelve, es
      // porque algo lo impidió y hay que decirlo en vez de quedarse callado.
      const state = await deleteLoanAction({}, formData);
      if (state?.error) setError(state.error);
    });
  };

  return { remove, pending, error };
}
