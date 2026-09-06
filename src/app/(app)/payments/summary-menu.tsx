"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Icon } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * Las acciones del resumen, detrás de los tres puntos.
 *
 * Mandarle el cierre al dueño y guardárselo. Estaban en un cuadro al final de
 * la pantalla, debajo de todo, que es donde no se buscan las acciones: ahora
 * están arriba, donde el pulgar las busca, y sin gastar pantalla mientras no
 * se usan.
 *
 * La hoja de compartir es la única manera de darle un archivo a otra
 * aplicación desde la web, y solo existe en el teléfono. En lo demás el
 * archivo se descarga y se abre el chat, para que la persona lo adjunte, en
 * vez de decirle que su navegador no puede.
 */
export function SummaryMenu({
  url,
  fileName,
  message,
}: {
  url: string;
  fileName: string;
  /** Lo que va en el chat al lado del archivo. */
  message: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Tocar fuera lo cierra, que es lo que uno espera de un menú.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const download = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  };

  const share = async () => {
    setBusy(true);
    setFallback(false);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("document");
      const file = new File([await response.blob()], fileName, {
        type: "application/pdf",
      });

      // canShare con el archivo es lo que de verdad dice que la hoja lo va a
      // recibir; navigator.share existe en navegadores que después lo niegan.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }

      download();
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener",
      );
      setFallback(true);
    } catch (error) {
      // Cerrar la hoja también lanza, y eso no es un fallo.
      if ((error as Error)?.name !== "AbortError") setFallback(true);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink hover:bg-surface-muted disabled:opacity-60";

  return (
    <div ref={box} className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon="more-vertical"
        aria-label={es.common.actions}
        aria-expanded={open}
        onClick={() => {
          // Abrir el menú se lleva el aviso: ya se leyó, y tapaba el día que
          // se está mirando mientras siguiera ahí.
          setFallback(false);
          setOpen(!open);
        }}
      />

      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <button
            type="button"
            className={item}
            disabled={busy}
            onClick={() => void share()}
          >
            <Icon name="message-circle" size={16} className="text-positive" />
            {busy ? es.payments.sharing : es.payments.summary.pdfShare}
          </button>
          <button
            type="button"
            className={`${item} border-t border-border`}
            onClick={() => {
              download();
              setOpen(false);
            }}
          >
            <Icon name="file-text" size={16} className="text-ink-subtle" />
            {es.payments.summary.pdfDownload}
          </button>
        </div>
      ) : null}

      {/* El aviso vive fuera del menú, que se cierra al compartir: dentro se
          iba con él y nadie alcanzaba a leer por qué se descargó el archivo
          en vez de abrirse la hoja. */}
      {fallback ? (
        <button
          type="button"
          className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-info-soft bg-info-soft/60 px-3 py-2 text-left text-xs text-ink"
          onClick={() => setFallback(false)}
        >
          {es.payments.summary.pdfFallback}
        </button>
      ) : null}
    </div>
  );
}
