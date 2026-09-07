"use client";

import { DocumentMenu } from "@/components/share/document-menu";
import { es } from "@/i18n/es";

/**
 * Las acciones del resumen del día, detrás de los tres puntos.
 *
 * Mandarle el cierre al dueño y guardárselo. Estaban en un cuadro al final de
 * la pantalla, debajo de todo, que es donde no se buscan las acciones: ahora
 * están arriba, donde el pulgar las busca, y sin gastar pantalla mientras no
 * se usan.
 */
export function SummaryMenu({
  url,
  fileName,
  message,
}: {
  url: string;
  fileName: string;
  message: string;
}) {
  return (
    <DocumentMenu
      url={url}
      fileName={fileName}
      message={message}
      labels={{
        share: es.payments.summary.pdfShare,
        download: es.payments.summary.pdfDownload,
        fallback: es.payments.summary.pdfFallback,
      }}
    />
  );
}
