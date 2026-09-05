"use client";

import { useEffect, useState } from "react";

import { Icon } from "./icon";
import { es } from "@/i18n/es";

/** Un nombre de archivo que se entienda en la galería, no un cuid. */
function fileName(src: string, caption?: string): string {
  const extension = src.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "jpg";
  const limpio = (caption ?? "foto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${limpio || "foto"}.${/^[a-z0-9]{3,4}$/.test(extension) ? extension : "jpg"}`;
}

/**
 * Una foto que se agranda al tocarla, y desde ahí se descarga o se comparte.
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
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);

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

  const nombre = fileName(src, caption);

  const descargar = () => {
    const enlace = document.createElement("a");
    enlace.href = src;
    enlace.download = nombre;
    enlace.click();
  };

  /**
   * Pasar la foto a otra aplicación.
   *
   * La hoja de compartir es la única forma que tiene la web de entregarle un
   * archivo a WhatsApp, y solo existe en el teléfono. Donde no está, se
   * descarga y se dice por qué, en vez de dejar el botón sin hacer nada.
   */
  const compartir = async () => {
    setBusy(true);
    setFallback(false);
    try {
      const respuesta = await fetch(src);
      if (!respuesta.ok) throw new Error("foto");
      const blob = await respuesta.blob();
      const archivo = new File([blob], nombre, {
        type: blob.type || "image/jpeg",
      });

      // canShare con el archivo es lo que de verdad dice que la hoja lo va a
      // aceptar; navigator.share existe en navegadores que después lo rechazan.
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          ...(caption ? { text: caption } : {}),
        });
        return;
      }

      descargar();
      setFallback(true);
    } catch (error) {
      // Cerrar la hoja sin compartir también lanza, y eso no es una falla.
      if ((error as Error)?.name !== "AbortError") {
        descargar();
        setFallback(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const redondo =
    "flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-50";

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
          {/* Los botones no cierran el visor al tocarlos. */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label={es.common.downloadPhoto}
              onClick={descargar}
              className={redondo}
            >
              <Icon name="arrow-down" size={20} />
            </button>
            <button
              type="button"
              aria-label={es.common.sharePhoto}
              onClick={() => void compartir()}
              disabled={busy}
              className={redondo}
            >
              <Icon name="send" size={18} />
            </button>
            <button
              type="button"
              aria-label={es.common.close}
              onClick={() => setOpen(false)}
              className={redondo}
            >
              <Icon name="x" size={20} />
            </button>
          </div>

          {/* Tocar la foto no la cierra: uno la toca para mirarla de cerca. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          {caption ? (
            <p className="mt-3 text-center text-sm text-white/80">{caption}</p>
          ) : null}
          {busy ? (
            <p className="mt-1 text-center text-xs text-white/70">
              {es.common.sharingPhoto}
            </p>
          ) : null}
          {fallback ? (
            <p
              className="mt-2 max-w-sm rounded-lg bg-white/15 px-3 py-2 text-center text-xs text-white"
              onClick={(event) => event.stopPropagation()}
            >
              {es.common.sharePhotoFallback}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
