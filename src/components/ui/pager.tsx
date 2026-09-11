import Link from "next/link";

import { PAGE_SIZE, pageRange } from "@/core/pagination";
import type { Translator } from "@/i18n";

import { Icon } from "./icon";

/**
 * Pasar páginas en una lista que se lee de a pantalla.
 *
 * El rango se ve siempre que haya más de una página: "51–63 de 63" contesta
 * las dos preguntas de una vez —dónde va uno y cuánto hay—, que era justo lo
 * que faltaba cuando la lista se cortaba en silencio.
 */

const LINK =
  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors";
const ENABLED =
  "border-border bg-surface text-ink-muted hover:bg-surface-muted";
const DISABLED = "border-border/60 bg-surface text-ink-subtle opacity-50";

export function Pager({
  page,
  total,
  path,
  pageSize = PAGE_SIZE,
  query = {},
  param = "p",
  t,
}: {
  /** Empezando en uno, como se escribe en la dirección. */
  page: number;
  /** Todo lo que cumple el filtro, no lo que vino en esta página. */
  total: number;
  path: string;
  pageSize?: number;
  /** Lo demás que lleva la dirección —la búsqueda, el filtro— tal cual está. */
  query?: Readonly<Record<string, string | undefined>>;
  param?: string;
  t: Translator;
}) {
  // Una sola página es la lista entera: un paginador ahí es un control que no
  // hace nada.
  if (total <= pageSize) return null;

  const { current, from, to, hasPrevious, hasNext } = pageRange(
    page,
    total,
    pageSize,
  );

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    // La primera página es la dirección sin el parámetro: la misma lista no
    // debería tener dos direcciones.
    if (target > 1) params.set(param, String(target));
    const search = params.toString();
    return search.length > 0 ? `${path}?${search}` : path;
  };

  return (
    <nav className="mt-3 flex items-center justify-between gap-2">
      {hasPrevious ? (
        <Link
          href={href(current - 1)}
          className={`${LINK} ${ENABLED}`}
          rel="prev"
        >
          <Icon name="chevron-left" size={14} />
          {t("common.previous")}
        </Link>
      ) : (
        <span className={`${LINK} ${DISABLED}`} aria-disabled="true">
          <Icon name="chevron-left" size={14} />
          {t("common.previous")}
        </span>
      )}

      <span className="numeric text-center text-xs text-ink-muted">
        {t("common.pagerRange", { from, to, total })}
      </span>

      {hasNext ? (
        <Link
          href={href(current + 1)}
          className={`${LINK} ${ENABLED}`}
          rel="next"
        >
          {t("common.next")}
          <Icon name="chevron-right" size={14} />
        </Link>
      ) : (
        <span className={`${LINK} ${DISABLED}`} aria-disabled="true">
          {t("common.next")}
          <Icon name="chevron-right" size={14} />
        </span>
      )}
    </nav>
  );
}
