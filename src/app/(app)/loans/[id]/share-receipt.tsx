"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * Mandarle al cliente el comprobante de un abono, desde el historial.
 *
 * Es una imagen y no un enlace a propósito: el cliente la recibe en el chat y
 * la ve ahí mismo, sin abrir un navegador ni gastar datos. Un botón y no un
 * menú porque aquí solo hay una cosa que hacer, y en una fila de tabla los
 * tres puntos serían un toque de más para llegar a lo mismo.
 */
export function ShareReceiptButton({
  paymentId,
  message,
  fileName,
}: {
  paymentId: string;
  /** Lo que va escrito en el chat al lado de la imagen. */
  message: string;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    const url = `/api/receipts/${paymentId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("receipt");
      const file = new File([await response.blob()], fileName, {
        type: "image/png",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }

      // Sin hoja de compartir —en el computador— se abre la imagen para
      // guardarla o arrastrarla al chat, que es lo más cerca que se puede.
      window.open(url, "_blank", "noopener");
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        window.open(url, "_blank", "noopener");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon="message-circle"
      className="text-positive"
      disabled={busy}
      aria-label={es.payments.shareReceipt}
      title={es.payments.shareReceipt}
      onClick={() => void share()}
    />
  );
}
