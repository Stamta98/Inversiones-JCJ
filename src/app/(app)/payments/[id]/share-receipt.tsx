"use client";

import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * Sends the receipt to the customer over WhatsApp, as a picture.
 *
 * The share sheet is the only way to hand a file to WhatsApp from the web, and
 * it only exists on a phone. Where it is missing — a desktop browser, an old
 * one — the image still downloads and the chat still opens, so the collector
 * can attach it themselves rather than being told no.
 */
export function ShareReceipt({
  paymentId,
  receiptNumber,
  message,
  phone,
}: {
  paymentId: string;
  receiptNumber: string;
  /** What goes in the chat next to the image. */
  message: string;
  /** The customer's number in digits, when there is one on file. */
  phone: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);

  const imageUrl = `/api/receipts/${paymentId}`;
  const fileName = `${receiptNumber}.png`;

  const openChat = () => {
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  };

  const download = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = fileName;
    link.click();
  };

  const share = async () => {
    setBusy(true);
    setFallback(false);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("receipt");
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      // canShare with files is what actually tells us the sheet will take it;
      // navigator.share alone exists on browsers that refuse files.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }

      download();
      openChat();
      setFallback(true);
    } catch (error) {
      // Cancelling the sheet throws too, and that is not a failure.
      if ((error as Error)?.name !== "AbortError") setFallback(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          icon="message-circle"
          onClick={() => void share()}
          disabled={busy}
        >
          {busy ? es.payments.sharing : es.payments.share}
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon="image"
          onClick={download}
        >
          {es.payments.download}
        </Button>
      </div>
      {fallback ? <Alert tone="info">{es.payments.shareFallback}</Alert> : null}
    </div>
  );
}
