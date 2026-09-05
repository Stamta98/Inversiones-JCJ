"use client";

import { useEffect, useState } from "react";

import { Icon } from "./icon";
import { es } from "@/i18n/es";

/**
 * Una foto que se agranda al tocarla.
 *
 * En el teléfono la foto del cliente sale del tamaño de una moneda, y con esa
 * no se le reconoce la cara en la puerta ni se le lee el número al documento.
 * Al tocarla se abre encima, tan grande como quepa en la pantalla, y se cierra
 * tocando fuera, con la equis o con Escape.
 */
export function PhotoZoom({
  src,
  alt,
  className,
  caption,
}: {
  src: string;
  /** Vacío cuando la foto va al lado del nombre y repetirlo sería ruido. */
  alt: string;
  /** Cómo se ve la foto en la pantalla, antes de agrandarla. */
  className: string;
  /** Lo que se lee debajo de la foto grande: de qué es. */
  caption?: string;
}) {
  const [open, setOpen] = useState(false);

  // Con la foto abierta, Escape la cierra y la página de atrás no se desliza.
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", escape);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = previo;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={caption ? `${es.common.zoom}: ${caption}` : es.common.zoom}
        className="block cursor-zoom-in"
      >
        {/* Same-origin, authenticated route; next/image adds nothing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={caption ?? es.common.zoom}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            aria-label={es.common.close}
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <Icon name="x" size={20} />
          </button>

          {/* Tocar la foto no la cierra: uno la toca para mirarla de cerca. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          {caption ? (
            <p className="mt-3 text-center text-sm text-white/80">{caption}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
