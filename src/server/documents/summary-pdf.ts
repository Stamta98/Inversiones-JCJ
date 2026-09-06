/**
 * El resumen del día, como PDF.
 *
 * Es el papel que el cobrador manda al dueño cuando cierra: qué cobró, qué
 * prestó, qué gastó y cuánto tiene que entregar. Se arma a mano, no a través
 * de un navegador, porque la app corre en funciones sin navegador desde donde
 * imprimir.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export interface SummaryDocumentData {
  company: {
    name: string;
    legalName: string | null;
    phone: string | null;
    city: string | null;
  };
  day: string;
  /** Los seis recuadros, en el mismo orden de la pantalla. */
  tiles: Array<{ label: string; amount: number; count: string }>;
  handOver: { label: string; amount: number; hint: string };
  /** De qué se compone lo que entró por abonos. */
  income: { title: string; rows: Array<{ label: string; amount: number }> };
  /** Lo que se movió: prestado, cargos y ganancia. */
  movement: {
    title: string;
    rows: Array<{ label: string; amount: number }>;
    profit: { label: string; amount: number };
  };
  /** Con qué pagaron: efectivo, transferencia. */
  paidWith: { title: string; rows: Array<{ label: string; amount: number }> };
  loans: {
    title: string;
    rows: Array<{ name: string; code: string; kind: string; amount: number }>;
  };
  payments: {
    title: string;
    columns: {
      receipt: string;
      customer: string;
      code: string;
      method: string;
      amount: string;
    };
    rows: Array<{
      receipt: string;
      name: string;
      code: string;
      method: string;
      amount: number;
      reversed: boolean;
    }>;
  };
  money: (amount: number) => string;
  labels: { title: string; footer: string; page: string; empty: string };
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

export async function buildSummaryPdf(
  data: SummaryDocumentData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`${data.labels.title} ${data.day}`);
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

  /** Corta un valor que se metería encima de su propia etiqueta. */
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

  /** Deja sitio para lo que viene; si no cabe, pasa de hoja. */
  const room = (height: number) => {
    if (y - height < MARGIN + 24) newPage();
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
  text(data.labels.title.toUpperCase(), MARGIN + width, y - 6, {
    size: 11,
    font: bold,
    color: BRAND,
    align: "right",
  });
  text(data.day, MARGIN + width, y - 22, {
    size: 10,
    color: MUTED,
    align: "right",
  });

  y -= 38;
  rule(y);
  y -= 22;

  // --- Los seis recuadros -------------------------------------------------
  // Tres por fila, como en el teléfono: seis en una sola fila dejan las cifras
  // más grandes sin sitio y se pisan con la de al lado.
  const perRow = 3;
  const tileWidth = width / perRow;
  const tileHeight = 52;
  const rows = Math.ceil(data.tiles.length / perRow);

  for (let row = 0; row < rows; row += 1) {
    room(tileHeight + 8);
    const top = y;
    data.tiles.slice(row * perRow, row * perRow + perRow).forEach((tile, i) => {
      const x = MARGIN + tileWidth * i;
      page.drawRectangle({
        x,
        y: top - tileHeight,
        width: tileWidth,
        height: tileHeight,
        color: SOFT,
        borderColor: LINE,
        borderWidth: 0.7,
      });
      text(fit(tile.label, tileWidth - 20, 8, regular), x + 10, top - 15, {
        size: 8,
        color: MUTED,
      });
      text(
        fit(data.money(tile.amount), tileWidth - 20, 13, bold),
        x + 10,
        top - 32,
        { size: 13, font: bold },
      );
      text(fit(tile.count, tileWidth - 20, 7.5, regular), x + 10, top - 44, {
        size: 7.5,
        color: MUTED,
      });
    });
    y -= tileHeight + 8;
  }

  // --- Lo que hay que entregar --------------------------------------------
  room(64);
  y -= 6;
  page.drawRectangle({
    x: MARGIN,
    y: y - 54,
    width,
    height: 54,
    color: SOFT,
    borderColor: LINE,
    borderWidth: 1,
  });
  text(data.handOver.label.toUpperCase(), MARGIN + 14, y - 17, {
    size: 8.5,
    font: bold,
    color: MUTED,
  });
  text(data.money(data.handOver.amount), MARGIN + 14, y - 38, {
    size: 20,
    font: bold,
    color: data.handOver.amount < 0 ? DANGER : INK,
  });
  text(fit(data.handOver.hint, width - 28, 8, regular), MARGIN + 14, y - 49, {
    size: 8,
    color: MUTED,
  });
  y -= 54 + 20;

  /** Un bloque de renglones «etiqueta … cifra». */
  const list = (
    title: string,
    lines: Array<{ label: string; amount: number; strong?: boolean }>,
  ) => {
    if (lines.length === 0) return;
    room(20 + lines.length * 15);
    text(title, MARGIN, y, { size: 11, font: bold });
    y -= 8;
    rule(y);
    y -= 14;
    lines.forEach((line) => {
      text(line.label, MARGIN, y, {
        size: 9.5,
        color: line.strong ? INK : MUTED,
        font: line.strong ? bold : regular,
      });
      text(data.money(line.amount), MARGIN + width, y, {
        size: 9.5,
        font: bold,
        align: "right",
        color: line.strong && line.amount < 0 ? DANGER : INK,
      });
      y -= 15;
    });
    y -= 8;
  };

  list(data.income.title, data.income.rows);
  list(data.movement.title, [
    ...data.movement.rows,
    { ...data.movement.profit, strong: true },
  ]);
  list(data.paidWith.title, data.paidWith.rows);

  // --- Los préstamos del día ----------------------------------------------
  if (data.loans.rows.length > 0) {
    room(20 + data.loans.rows.length * 15);
    text(data.loans.title, MARGIN, y, { size: 11, font: bold });
    y -= 8;
    rule(y);
    y -= 14;
    data.loans.rows.forEach((loan) => {
      room(15);
      text(fit(loan.name, width * 0.45, 9.5, regular), MARGIN, y, {
        size: 9.5,
      });
      text(
        fit(`${loan.code} · ${loan.kind}`, width * 0.3, 8.5, regular),
        MARGIN + width * 0.48,
        y,
        { size: 8.5, color: MUTED },
      );
      text(data.money(loan.amount), MARGIN + width, y, {
        size: 9.5,
        font: bold,
        align: "right",
      });
      y -= 15;
    });
    y -= 8;
  }

  // --- Los abonos ---------------------------------------------------------
  const columns = [
    { label: data.payments.columns.receipt, x: MARGIN, align: "left" as const },
    {
      label: data.payments.columns.customer,
      x: MARGIN + 86,
      align: "left" as const,
    },
    {
      label: data.payments.columns.code,
      x: MARGIN + 240,
      align: "left" as const,
    },
    {
      label: data.payments.columns.method,
      x: MARGIN + 330,
      align: "left" as const,
    },
    {
      label: data.payments.columns.amount,
      x: MARGIN + width,
      align: "right" as const,
    },
  ];

  const paymentsHeader = () => {
    columns.forEach((column) => {
      text(column.label, column.x, y, {
        size: 8,
        font: bold,
        color: MUTED,
        align: column.align,
      });
    });
    y -= 8;
    rule(y);
    y -= 14;
  };

  room(46);
  text(data.payments.title, MARGIN, y, { size: 11, font: bold });
  y -= 18;

  if (data.payments.rows.length === 0) {
    text(data.labels.empty, MARGIN, y, { size: 9.5, color: MUTED });
    y -= 15;
  } else {
    paymentsHeader();
    for (const payment of data.payments.rows) {
      if (y < MARGIN + 36) {
        newPage();
        paymentsHeader();
      }
      // Un cobro anulado se imprime igual, tachado en rojo: si no sale, el
      // papel no cuadra con la pantalla y parece que alguien lo escondió.
      const color = payment.reversed ? DANGER : INK;
      text(payment.receipt, columns[0].x, y, { size: 8.5, color });
      text(fit(payment.name, 148, 8.5, regular), columns[1].x, y, {
        size: 8.5,
        color,
      });
      text(payment.code, columns[2].x, y, { size: 8.5, color });
      text(fit(payment.method, 88, 8.5, regular), columns[3].x, y, {
        size: 8.5,
        color,
      });
      text(data.money(payment.amount), columns[4].x, y, {
        size: 8.5,
        font: bold,
        align: "right",
        color,
      });
      y -= 15;
    }
  }

  // --- Pie y numeración ---------------------------------------------------
  if (y < MARGIN + 30) newPage();
  y -= 12;
  text(data.labels.footer, MARGIN, y, { size: 8.5, color: MUTED });

  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    const label = toLatin1(
      data.labels.page
        .replace("{current}", String(index + 1))
        .replace("{total}", String(pages.length)),
    );
    sheet.drawText(label, {
      x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 16,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return pdf.save();
}
