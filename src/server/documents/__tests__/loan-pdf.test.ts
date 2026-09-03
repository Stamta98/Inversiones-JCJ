import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildLoanPdf, type LoanDocumentData } from "../loan-pdf";

const labels: Record<string, string> = {
  title: "Comprobante de préstamo",
  principal: "Monto prestado",
  interest: "Interés total",
  totalToPay: "Total a pagar",
  installment: "Cuota",
  customer: "Cliente",
  document: "Número de documento",
  address: "Dirección de la casa",
  phone: "Celular / WhatsApp",
  method: "Modalidad de interés",
  rate: "Tasa de interés (%)",
  frequency: "Frecuencia de pago",
  termCount: "Cantidad de cuotas",
  disbursedAt: "Fecha de desembolso",
  firstDueDate: "Fecha de la primera cuota",
  lastDueDate: "Fecha de vencimiento",
  status: "Estado",
  schedule: "Tabla de amortización",
  number: "N.º",
  dueDate: "Vencimiento",
  capital: "Capital",
  interestShort: "Interés",
  lateFee: "Mora",
  total: "Cuota",
  balance: "Saldo",
  signCustomer: "Firma del cliente",
  signCompany: "Por la empresa",
  footer: "Este documento detalla las condiciones acordadas y el plan de cuotas.",
  page: "Página",
  of: "de",
};

function installment(number: number, lateFee = 0) {
  return {
    number,
    dueDate: new Date(2026, 8, number),
    principal: 125_000,
    interest: 25_000,
    lateFee,
    total: 150_000 + lateFee,
    balanceAfter: 600_000 - number * 150_000,
  };
}

function data(overrides: Partial<LoanDocumentData> = {}): LoanDocumentData {
  return {
    company: {
      name: "Inversiones JCJ",
      legalName: "Inversiones JCJ S.A.S.",
      phone: "601 555 0100",
      city: "Bogotá",
      address: "Carrera 7 22-31",
    },
    customer: {
      fullName: "José Rodríguez",
      document: "1.020.304.050",
      address: "Carrera 80 65-12",
      phone: "573001110102",
    },
    loan: {
      code: "PRE-000002",
      principal: 500_000,
      interest: 100_000,
      totalToPay: 600_000,
      installmentAmount: 150_000,
      interestRate: 20,
      rateBasisLabel: "del préstamo",
      methodLabel: "Porcentaje simple (fijo sobre el capital)",
      frequencyLabel: "Semanal",
      termCount: 4,
      disbursedAt: new Date(2026, 8, 8),
      firstDueDate: new Date(2026, 8, 8),
      lastDueDate: new Date(2026, 8, 29),
      statusLabel: "Activo",
      originLabel: null,
      parentCode: null,
    },
    installments: [1, 2, 3, 4].map((number) => installment(number)),
    money: (amount) => `$ ${amount.toLocaleString("es-CO")}`,
    day: (date) => date.toLocaleDateString("es-CO"),
    labels,
    ...overrides,
  };
}

describe("buildLoanPdf", () => {
  it("produces a real PDF", async () => {
    const bytes = await buildLoanPdf(data());

    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("keeps a short schedule on one page", async () => {
    const document = await PDFDocument.load(await buildLoanPdf(data()));

    expect(document.getPageCount()).toBe(1);
  });

  it("carries a long schedule onto more pages", async () => {
    const installments = Array.from({ length: 60 }, (_, index) =>
      installment(index + 1),
    );
    const document = await PDFDocument.load(
      await buildLoanPdf(data({ installments })),
    );

    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  // The standard fonts only speak Latin-1, and a name outside it used to throw
  // rather than print. A customer must always get their paper.
  it("prints a name the standard fonts cannot spell", async () => {
    const bytes = await buildLoanPdf(
      data({
        customer: {
          fullName: "Иван Петров 中文",
          document: "—",
          address: "Calle 1 “A” № 2",
          phone: null,
        },
      }),
    );

    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  // A refinanced loan whose paper does not name the loan it replaced looks
  // like a second debt for the same money.
  it("names the loan a refinance replaced", async () => {
    const plain = await buildLoanPdf(data());
    const refinanced = await buildLoanPdf(
      data({
        loan: {
          ...data().loan,
          originLabel: "Refinanciación",
          parentCode: "PRE-000001",
        },
      }),
    );

    expect(refinanced.byteLength).toBeGreaterThan(plain.byteLength);
  });

  // A "cuota" larger than capital plus interest with nothing explaining why
  // reads as an arithmetic error, so the late fee gets its own column.
  it("only spends a column on the late fee when there is one", async () => {
    const clean = await buildLoanPdf(data());
    const withArrears = await buildLoanPdf(
      data({
        installments: [
          installment(1, 2_400),
          installment(2),
          installment(3),
          installment(4),
        ],
      }),
    );

    expect(withArrears.byteLength).toBeGreaterThan(clean.byteLength);
  });
});
