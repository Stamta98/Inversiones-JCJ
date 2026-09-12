"use client";

import { useEffect, useState } from "react";

import { forSearch } from "@/lib/search";

import { Icon, Input } from "./index";

/**
 * Busca mientras se escribe, sin recargar la lista.
 *
 * La lista viene entera del servidor y aquí solo se esconde lo que no
 * coincide. Antes había que teclear y darle enter, y cada letra que sobraba
 * era otra vuelta al servidor: en la calle, con mala señal, eran segundos por
 * cliente. Ahora se ve filtrando desde la primera letra.
 *
 * Cada fila trae en `data-search` su propio texto ya normalizado —lo pone
 * `Card` con `searchText`—, así que aquí no hay que saber qué lleva dentro.
 */
export function LiveSearch({
  placeholder,
  label,
  emptyLabel,
  className,
}: {
  placeholder: string;
  label: string;
  /** Lo que se dice cuando ninguna fila coincide. */
  emptyLabel: string;
  className?: string;
}) {
  const [term, setTerm] = useState("");
  const [nothing, setNothing] = useState(false);

  useEffect(() => {
    const apply = () => {
      const needle = forSearch(term);
      const rows = document.querySelectorAll<HTMLElement>("[data-search]");
      let shown = 0;
      rows.forEach((row) => {
        const hit =
          needle === "" || (row.dataset.search ?? "").includes(needle);
        // En el estilo y no en una clase: la fila ya trae las suyas y una
        // utilidad de esconder podría perder contra ellas según el orden en
        // que se cargue la hoja. El estilo de la etiqueta le gana a todas.
        row.style.display = hit ? "" : "none";
        if (hit) shown += 1;
      });
      setNothing(rows.length > 0 && shown === 0);
    };

    apply();

    // La lista se vuelve a dibujar sola después de cobrar o de reordenar, y
    // las filas nuevas llegan visibles. Sin esto, lo que se estaba buscando se
    // perdía y volvían a salir todas.
    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [term]);

  return (
    <div className={className}>
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-subtle"
        />
        <Input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          className="pl-9"
        />
      </div>
      {nothing ? (
        <p className="mt-3 text-center text-sm text-ink-muted">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
