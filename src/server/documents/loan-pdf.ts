/**
 * The loan document, as a PDF.
 *
 * A customer signs for a loan and keeps the paper: the amounts, the dates of
 * every installment, and what they end up paying in total. This builds that
 * page — laid out by hand rather than through a browser, because the app runs
 * on serverless functions where there is no browser to print from.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface LoanDocumentData {
  company: {
    name: string;
    legalName: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
  };
  customer: {
    fullName: string;
    document: string;
    address: string | null;
    phone: string | null;
  };
  loan: {
    code: string;
    principal: number;
    interest: number;
    totalToPay: number;
    installmentAmount: number;
    interestRate: number;
    rateBasisLabel: string;
    methodLabel: string;
    frequencyLabel: string;
    termCount: number;
    disbursedAt: Date | null;
    firstDueDate: Date;
    lastDueDate: Date | null;
    statusLabel: string;
    /** Set when this loan replaced another one, so the paper says so. */
    originLabel: string | null;
    parentCode: string | null;
  };
  installments: Array<{
    number: number;
    dueDate: Date;
    principal: number;
    interest: number;
    lateFee: number;
    total: number;
    balanceAfter: number;
  }>;
  /** Formatters, so the document reads in the company's own currency. */
  money: (amount: number) => string;
  day: (date: Date) => string;
  labels: Record<string, string>;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 44;
const INK = rgb(0.11, 0.13, 0.15);
const MUTED = rgb(0.36, 0.42, 0.45);
const BRAND = rgb(0.06, 0.46, 0.43);
const LINE = rgb(0.89, 0.9, 0.91);

/**
 * The standard fonts only speak Latin-1, and a name with a character outside
 * it would throw rather than print. Anything unknown becomes a plain
 * equivalent, so a document always comes out.
 */
function toLatin1(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .split("")
    .map((character) =>
      character.charCodeAt(0) <= 0xff ? character : "?",
    )
    .join("");
}

interface Cursor {
  page: PDFPage;
  y: number;
  pageNumber: number;
}

export async function buildLoanPdf(data: LoanDocumentData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`${data.labels.title} ${data.loan.code}`);
  pdf.setAuthor(data.company.name);

  const cursor: Cursor = {
    page: pdf.addPage(A4),
    y: A4[1] - MARGIN,
    pageNumber: 1,
  };

  const width = A4[0] - MARGIN * 2;

  const text = (
    value: string,
    x: number,
    y: number,
    options: { size?: number; font?: PDFFont; color?: typeof INK; align?: "left" | "right" } = {},
  ) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const clean = toLatin1(value);
    const offset =
      options.align === "right" ? font.widthOfTextAtSize(clean, size) : 0;
    cursor.page.drawText(clean, {
      x: x - offset,
      y,
      size,
      font,
      color: options.color ?? INK,
    });
  };

  /**
   * Shortens a value that would run into its own label. A truncated
   * "Porcentaje simple (fij..." still reads; the two overlapping do not.
   */
  const fit = (value: string, maxWidth: number, size: number, font: PDFFont) => {
    const clean = toLatin1(value);
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;

    let cut = clean;
    while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) {
      cut = cut.slice(0, -1);
    }
    return `${cut.trimEnd()}...`;
  };

  /**
   * A long value gets smaller type before it gets cut. "Porcentaje simple
   * (fijo sobre el capital)" truncated to "fijo sobre el..." tells the reader
   * nothing; two points of type does.
   */
  const shrinkToFit = (
    value: string,
    maxWidth: number,
    size: number,
    font: PDFFont,
  ): { value: string; size: number } => {
    const clean = toLatin1(value);
    let current = size;
    while (current > 7 && font.widthOfTextAtSize(clean, current) > maxWidth) {
      current -= 0.5;
    }
    return { value: fit(clean, maxWidth, current, font), size: current };
  };

  const rule = (y: number) => {
    cursor.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + width, y },
      thickness: 0.7,
      color: LINE,
    });
  };

  const newPage = () => {
    cursor.page = pdf.addPage(A4);
    cursor.pageNumber += 1;
    cursor.y = A4[1] - MARGIN;
  };

  // --- Header -------------------------------------------------------------
  text(data.company.name, MARGIN, cursor.y - 6, { size: 17, font: bold });
  text(
    [data.company.legalName, data.company.phone, data.company.city]
      .filter(Boolean)
      .join("  ·  "),
    MARGIN,
    cursor.y - 22,
    { size: 9, color: MUTED },
  );

  text(data.labels.title.toUpperCase(), MARGIN + width, cursor.y - 6, {
    size: 11,
    font: bold,
    color: BRAND,
    align: "right",
  });
  text(data.loan.code, MARGIN + width, cursor.y - 22, {
    size: 10,
    color: MUTED,
    align: "right",
  });

  cursor.y -= 38;
  rule(cursor.y);
  cursor.y -= 22;

  // --- What the loan costs ------------------------------------------------
  const facts: Array<[string, string]> = [
    [data.labels.principal, data.money(data.loan.principal)],
    [data.labels.interest, data.money(data.loan.interest)],
    [data.labels.totalToPay, data.money(data.loan.totalToPay)],
    [data.labels.installment, data.money(data.loan.installmentAmount)],
  ];

  const boxHeight = 54;
  cursor.page.drawRectangle({
    x: MARGIN,
    y: cursor.y - boxHeight + 14,
    width,
    height: boxHeight,
    color: rgb(0.96, 0.97, 0.97),
    borderColor: LINE,
    borderWidth: 0.7,
  });

  const columnWidth = width / facts.length;
  facts.forEach(([label, value], index) => {
    const x = MARGIN + columnWidth * index + 14;
    text(label, x, cursor.y - 4, { size: 8, color: MUTED });
    text(value, x, cursor.y - 22, { size: 13, font: bold });
  });

  cursor.y -= boxHeight + 18;

  // --- Who and on what terms ---------------------------------------------
  const pairs: Array<[string, string]> = [
    [data.labels.customer, data.customer.fullName],
    [data.labels.document, data.customer.document],
    [data.labels.address, data.customer.address ?? "-"],
    [data.labels.phone, data.customer.phone ?? "-"],
    [data.labels.method, data.loan.methodLabel],
    [
      data.labels.rate,
      `${data.loan.interestRate}% ${data.loan.rateBasisLabel}`,
    ],
    [data.labels.frequency, data.loan.frequencyLabel],
    [data.labels.termCount, String(data.loan.termCount)],
    [
      data.labels.disbursedAt,
      data.loan.disbursedAt ? data.day(data.loan.disbursedAt) : "-",
    ],
    [data.labels.firstDueDate, data.day(data.loan.firstDueDate)],
    [
      data.labels.lastDueDate,
      data.loan.lastDueDate ? data.day(data.loan.lastDueDate) : "-",
    ],
    [data.labels.status, data.loan.statusLabel],
  ];

  // A refinanced loan whose paper does not name the loan it replaced looks
  // like a second debt for the same money.
  if (data.loan.originLabel && data.loan.parentCode) {
    pairs.push([data.loan.originLabel, data.loan.parentCode]);
  }

  const half = width / 2;
  pairs.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + column * half;
    const y = cursor.y - row * 17;
    const labelWidth = regular.widthOfTextAtSize(toLatin1(label), 8.5);
    text(label, x, y, { size: 8.5, color: MUTED });
    const shrunk = shrinkToFit(value, half - 26 - labelWidth, 9.5, bold);
    text(shrunk.value, x + half - 14, y, {
      size: shrunk.size,
      font: bold,
      align: "right",
    });
  });

  cursor.y -= Math.ceil(pairs.length / 2) * 17 + 12;
  rule(cursor.y);
  cursor.y -= 20;

  // --- The installments ---------------------------------------------------
  // The late fee only gets a column when there is one to show: a loan with no
  // arrears deserves a clean plan, and one with arrears cannot have a "cuota"
  // that is more than capital plus interest with nothing explaining why.
  const hasLateFees = data.installments.some(
    (installment) => installment.lateFee > 0,
  );

  const columns = hasLateFees
    ? [
        { label: data.labels.number, x: MARGIN, align: "left" as const },
        { label: data.labels.dueDate, x: MARGIN + 42, align: "left" as const },
        { label: data.labels.capital, x: MARGIN + 218, align: "right" as const },
        { label: data.labels.interestShort, x: MARGIN + 292, align: "right" as const },
        { label: data.labels.lateFee, x: MARGIN + 366, align: "right" as const },
        { label: data.labels.total, x: MARGIN + 440, align: "right" as const },
        { label: data.labels.balance, x: MARGIN + width, align: "right" as const },
      ]
    : [
        { label: data.labels.number, x: MARGIN, align: "left" as const },
        { label: data.labels.dueDate, x: MARGIN + 46, align: "left" as const },
        { label: data.labels.capital, x: MARGIN + 250, align: "right" as const },
        { label: data.labels.interestShort, x: MARGIN + 340, align: "right" as const },
        { label: data.labels.total, x: MARGIN + 430, align: "right" as const },
        { label: data.labels.balance, x: MARGIN + width, align: "right" as const },
      ];

  const header = () => {
    columns.forEach((column) => {
      text(column.label, column.x, cursor.y, {
        size: 8,
        font: bold,
        color: MUTED,
        align: column.align,
      });
    });
    cursor.y -= 8;
    rule(cursor.y);
    cursor.y -= 14;
  };

  text(data.labels.schedule, MARGIN, cursor.y + 16, { size: 11, font: bold });
  header();

  for (const installment of data.installments) {
    if (cursor.y < MARGIN + 36) {
      newPage();
      header();
    }

    const values = hasLateFees
      ? [
          String(installment.number),
          data.day(installment.dueDate),
          data.money(installment.principal),
          data.money(installment.interest),
          installment.lateFee > 0 ? data.money(installment.lateFee) : "-",
          data.money(installment.total),
          data.money(installment.balanceAfter),
        ]
      : [
          String(installment.number),
          data.day(installment.dueDate),
          data.money(installment.principal),
          data.money(installment.interest),
          data.money(installment.total),
          data.money(installment.balanceAfter),
        ];

    const totalIndex = hasLateFees ? 5 : 4;
    columns.forEach((column, index) => {
      text(values[index]!, column.x, cursor.y, {
        size: hasLateFees ? 8.5 : 9,
        align: column.align,
        font: index === totalIndex ? bold : regular,
        color: index === totalIndex - 1 && hasLateFees && installment.lateFee > 0
          ? rgb(0.72, 0.11, 0.11)
          : INK,
      });
    });

    cursor.y -= 16;
  }

  // --- Signatures ---------------------------------------------------------
  if (cursor.y < MARGIN + 110) newPage();
  cursor.y -= 24;

  const signatureWidth = (width - 40) / 2;
  [data.labels.signCustomer, data.labels.signCompany].forEach((label, index) => {
    const x = MARGIN + index * (signatureWidth + 40);
    cursor.page.drawLine({
      start: { x, y: cursor.y },
      end: { x: x + signatureWidth, y: cursor.y },
      thickness: 0.7,
      color: INK,
    });
    text(label, x, cursor.y - 12, { size: 8.5, color: MUTED });
  });

  cursor.y -= 40;
  text(data.labels.footer, MARGIN, cursor.y, { size: 8.5, color: MUTED });

  // --- Page numbers -------------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const label = toLatin1(
      data.labels.page
        .replace("{current}", String(index + 1))
        .replace("{total}", String(pages.length)),
    );
    page.drawText(label, {
      x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 16,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return pdf.save();
}
