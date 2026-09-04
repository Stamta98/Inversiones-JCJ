"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * Los abonos viejos, detrás de una línea.
 *
 * En la puerta se miran los últimos tres — "¿le llegó el del viernes?" — y el
 * resto solo cuando el cliente reclama algo de hace meses. Con veinte
 * renglones abiertos, lo de arriba queda a media pantalla de distancia.
 */
export function HistoryMore({
  columns,
  hidden,
  children,
}: {
  /** Cuántas columnas tiene la tabla, para que la línea las cruce entera. */
  columns: number;
  hidden: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? children : null}
      <tr>
        <td colSpan={columns} className="p-0">
          {/* La tabla es más ancha que el teléfono y se desplaza de lado: la
              línea se toca en cualquier parte, pero su texto va pegado al
              borde izquierdo para que nunca quede fuera de la pantalla. */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex w-full items-center py-2 text-sm font-medium text-brand-strong"
          >
            <span className="sticky left-0 flex items-center gap-1.5 px-3 hover:underline">
              <Icon
                name="chevron-down"
                size={16}
                className={`transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open
                ? es.payments.showLess
                : es.payments.showAll.replace("{count}", String(hidden))}
            </span>
          </button>
        </td>
      </tr>
    </>
  );
}
