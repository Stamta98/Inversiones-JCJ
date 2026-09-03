"use client";

import { useState } from "react";

import { Alert, Button } from "./index";
import type { IconName } from "./icon";

/**
 * Hands a generated file — a receipt image, a loan document — to WhatsApp.
 *
 * The share sheet is the only way to give a file to another app from the web,
 * and it only exists on a phone. Everywhere else the file downloads and the
 * chat opens, so the person can attach it themselves rather than being told
 * their browser cannot do it.
 */
export function ShareDocument({
  url,
  fileName,
  mimeType,
  message,
  phone,
  shareLabel,
  downloadLabel,
  busyLabel,
  fallbackLabel,
  downloadIcon = "image",
}: {
  url: string;
  fileName: string;
  mimeType: string;
  /** What goes in the chat next to the file. */
  message: string;
  /** The customer's number in digits, when there is one on file. */
  phone: string | null;
  shareLabel: string;
  downloadLabel: string;
  busyLabel: string;
  fallbackLabel: string;
  downloadIcon?: IconName;
}) {
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);

  const openChat = () => {
    const chat = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(chat, "_blank", "noopener");
  };

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
        type: mimeType,
      });

      // canShare with the file is what actually says the sheet will take it;
      // navigator.share exists on browsers that then refuse files.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }

      download();
      openChat();
      setFallback(true);
    } catch (error) {
      // Dismissing the sheet throws as well, and that is not a failure.
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
          {busy ? busyLabel : shareLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={downloadIcon}
          onClick={download}
        >
          {downloadLabel}
        </Button>
      </div>
      {fallback ? <Alert tone="info">{fallbackLabel}</Alert> : null}
    </div>
  );
}
