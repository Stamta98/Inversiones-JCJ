/**
 * El historial de abonos de un préstamo, como PDF.
 *
 * Es el papel que se le manda al cliente cuando pregunta «¿y todo lo que le
 * he pagado?». Va aparte del comprobante de un abono: ese prueba un pago,
 * este cuenta la historia entera del crédito.
 *
 * Se arma a mano, igual que el resumen del día, porque la app corre en
 * funciones sin navegador desde donde imprimir.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export interface HistoryDocumentData {
  company: {
    name: string;
    legalName: string | null;
    phone: string | null;
    city: string | null;
  };
  title: string;
  /** «Préstamo PRE-000014 · Luis Fernández». */
  subject: string;
  /** Lo que encabeza la hoja: capital, total, abonado, saldo. */
  facts: Array<{ label: string; value: string }>;
  /** En qué se repartió todo lo abonado. */
  applied: { title: string; rows: Array<{ label: string; amount: number }> };
  columns: { date: string; concept: string; amount: string; balance: string };
  rows: Array<{
    date: string;
    time: string;
    concept: string;
    detail: string;
    amount: number;
    /** Vacío cuando el renglón no mueve el saldo, como un cargo aparte. */
    balance: string;
    reversed: boolean;
  }>;
  empty: string;
  money: (amount: number) => string;
  /** Pie: «Página 1 de 2». */
  pageLabel: (current: number, total: number) => string;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 44;
const INK = rgb(0.11, 0.13, 0.15);
const MUTED = rgb(0.36, 0.42, 0.45);
const BRAND = rgb(0.06, 0.46, 0.43);
const DANGER = rgb(0.72, 0.11, 0.11);
const LINE = rgb(0.89, 0.9, 0.91);
const SOFT = rgb(0.96, 0.97, 0.97);

/**
 * Las fuentes estándar solo hablan Latin-1, y un nombre con una letra de
 * fuera reventaría en vez de imprimirse. Lo desconocido se cambia por algo
 * llano, para que el papel siempre salga.
 */
function toLatin1(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[«»]/g, '"')
    .replace(/ /g, " ")
    .split("")
    .map((character) => (character.charCodeAt(0) <= 0xff ? character : "?"))
    .join("");
}

export async function buildHistoryPdf(
  data: HistoryDocumentData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`${data.title} · ${data.subject}`);
  pdf.setAuthor(data.company.name);

  const width = A4[0] - MARGIN * 2;
  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const text = (
    value: string,
    x: number,
    top: number,
    options: {
      size?: number;
      font?: PDFFont;
      color?: typeof INK;
      align?: "left" | "right";
    } = {},
  ) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const clean = toLatin1(value);
    const offset =
      options.align === "right" ? font.widthOfTextAtSize(clean, size) : 0;
    page.drawText(clean, {
      x: x - offset,
      y: top,
      size,
      font,
      color: options.color ?? INK,
    });
  };

  /** Corta un valor que se metería encima de la columna de al lado. */
  const fit = (
    value: string,
    maxWidth: number,
    size: number,
    font: PDFFont,
  ) => {
    const clean = toLatin1(value);
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
    let cut = clean;
    while (
      cut.length > 1 &&
      font.widthOfTextAtSize(`${cut}...`, size) > maxWidth
    ) {
      cut = cut.slice(0, -1);
    }
    return `${cut.trimEnd()}...`;
  };

  const rule = (top: number) => {
    page.drawLine({
      start: { x: MARGIN, y: top },
      end: { x: MARGIN + width, y: top },
      thickness: 0.7,
      color: LINE,
    });
  };

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };

  const room = (height: number) => {
    if (y - height < MARGIN + 28) return newPage();
  };

  // --- Encabezado ---------------------------------------------------------
  text(data.company.name, MARGIN, y - 6, { size: 17, font: bold });
  text(
    [data.company.legalName, data.company.phone, data.company.city]
      .filter(Boolean)
      .join("  ·  "),
    MARGIN,
    y - 22,
    { size: 9, color: MUTED },
  );
  text(data.title.toUpperCase(), MARGIN + width, y - 6, {
    size: 11,
    font: bold,
    color: BRAND,
    align: "right",
  });
  text(data.subject, MARGIN + width, y - 22, {
    size: 10,
    color: MUTED,
    align: "right",
  });
  y -= 36;
  rule(y);
  y -= 20;

  // --- Las cifras de cabecera, de a dos por fila --------------------------
  for (let index = 0; index < data.facts.length; index += 2) {
    const pair = data.facts.slice(index, index + 2);
    room(30);
    pair.forEach((fact, column) => {
      const x = MARGIN + column * (width / 2);
      text(fact.label, x, y, { size: 9, color: MUTED });
      text(fact.value, x, y - 14, { size: 12, font: bold });
    });
    y -= 34;
  }

  // --- En qué se repartió lo abonado --------------------------------------
  if (data.applied.rows.length > 0) {
    room(28 + data.applied.rows.length * 15);
    y -= 4;
    text(data.applied.title, MARGIN, y, { size: 11, font: bold });
    y -= 16;
    for (const row of data.applied.rows) {
      text(row.label, MARGIN, y, { size: 10, color: MUTED });
      text(data.money(row.amount), MARGIN + width, y, {
        size: 10,
        align: "right",
      });
      y -= 15;
    }
    y -= 6;
  }

  // --- La tabla ------------------------------------------------------------
  const columns = {
    date: MARGIN,
    concept: MARGIN + 108,
    amount: MARGIN + width - 108,
    balance: MARGIN + width,
  };

  const header = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 15,
      width,
      height: 19,
      color: SOFT,
    });
    text(data.columns.date, columns.date + 6, y - 10, {
      size: 8,
      font: bold,
      color: MUTED,
    });
    text(data.columns.concept, columns.concept, y - 10, {
      size: 8,
      font: bold,
      color: MUTED,
    });
    text(data.columns.amount, columns.amount, y - 10, {
      size: 8,
      font: bold,
      color: MUTED,
      align: "right",
    });
    text(data.columns.balance, columns.balance - 6, y - 10, {
      size: 8,
      font: bold,
      color: MUTED,
      align: "right",
    });
    y -= 24;
  };

  room(60);
  header();

  if (data.rows.length === 0) {
    text(data.empty, MARGIN, y - 4, { size: 10, color: MUTED });
    y -= 18;
  }

  for (const row of data.rows) {
    // Un renglón con detalle ocupa dos líneas; se comprueba antes de entrar
    // para que el detalle no quede huérfano al principio de la hoja
    // siguiente.
    const height = row.detail ? 30 : 20;
    if (y - height < MARGIN + 28) {
      newPage();
      header();
    }

    text(row.date, columns.date, y, { size: 9.5 });
    if (row.time) {
      text(row.time, columns.date + 52, y, { size: 8.5, color: MUTED });
    }
    text(
      fit(row.concept, columns.amount - columns.concept - 12, 9.5, regular),
      columns.concept,
      y,
      { size: 9.5 },
    );
    text(data.money(row.amount), columns.amount, y, {
      size: 10,
      font: bold,
      color: row.reversed ? DANGER : INK,
      align: "right",
    });
    text(row.balance, columns.balance - 6, y, {
      size: 9.5,
      color: MUTED,
      align: "right",
    });

    if (row.detail) {
      text(
        fit(row.detail, width - 120, 8.5, regular),
        columns.concept,
        y - 11,
        { size: 8.5, color: MUTED },
      );
    }

    y -= height;
    rule(y + 7);
  }

  // --- El pie de cada hoja -------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    const label = toLatin1(data.pageLabel(index + 1, pages.length));
    sheet.drawText(label, {
      // Pegado al margen derecho: `drawText` dibuja desde la izquierda, así
      // que hay que restarle lo que mide.
      x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 16,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return pdf.save();
}
