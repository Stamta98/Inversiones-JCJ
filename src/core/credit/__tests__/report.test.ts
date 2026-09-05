import { describe, expect, it } from "vitest";

import {
  NOTICE_DAYS_REQUIRED,
  isExpired,
  isUsableDocument,
  noticeAllowsReport,
  normalizeDocument,
  reportExpiresAt,
} from "../report";

const día = 24 * 60 * 60 * 1000;

describe("normalizeDocument", () => {
  it("deja la misma cédula igual, esté escrita como esté", () => {
    // La misma persona escrita de cuatro maneras tiene que caer en la misma
    // llave: si no, el reporte existe y nadie lo encuentra.
    const formas = ["1.014.256.789", "1014256789", "1 014 256 789", "1-014-256-789"];
    const llaves = new Set(formas.map(normalizeDocument));
    expect(llaves.size).toBe(1);
    expect([...llaves][0]).toBe("1014256789");
  });

  it("sube las letras, para las cédulas que las llevan", () => {
    expect(normalizeDocument("v-12.345.678")).toBe("V12345678");
  });

  it("no acepta lo que no distingue a nadie", () => {
    expect(isUsableDocument("123")).toBe(false);
    expect(isUsableDocument("   ")).toBe(false);
    expect(isUsableDocument("1014256789")).toBe(true);
  });
});

describe("noticeAllowsReport", () => {
  const hoy = new Date("2026-09-05T12:00:00.000Z");

  it("sin aviso no se puede reportar", () => {
    // Reportar de sorpresa es justo lo que no se puede hacer.
    const { ok, daysLeft } = noticeAllowsReport(null, hoy);
    expect(ok).toBe(false);
    expect(daysLeft).toBe(NOTICE_DAYS_REQUIRED);
  });

  it("avisado ayer, todavía no", () => {
    const ayer = new Date(hoy.getTime() - día);
    const { ok, daysLeft } = noticeAllowsReport(ayer, hoy);
    expect(ok).toBe(false);
    expect(daysLeft).toBe(NOTICE_DAYS_REQUIRED - 1);
  });

  it("cumplida la espera, sí", () => {
    const hace20 = new Date(hoy.getTime() - NOTICE_DAYS_REQUIRED * día);
    expect(noticeAllowsReport(hace20, hoy)).toEqual({ ok: true, daysLeft: 0 });
  });

  it("un aviso viejo sigue sirviendo", () => {
    const hace100 = new Date(hoy.getTime() - 100 * día);
    expect(noticeAllowsReport(hace100, hoy).ok).toBe(true);
  });
});

describe("cuánto dura un reporte", () => {
  const hecho = new Date("2026-09-05T00:00:00.000Z");

  it("el atraso pesa menos que la mora, y el fraude más que las dos", () => {
    expect(reportExpiresAt(hecho, "LATE").getUTCFullYear()).toBe(2028);
    expect(reportExpiresAt(hecho, "DEFAULT").getUTCFullYear()).toBe(2030);
    expect(reportExpiresAt(hecho, "FRAUD").getUTCFullYear()).toBe(2032);
  });

  it("mientras no caduque, se ve", () => {
    const unAñoDespués = new Date("2027-09-05T00:00:00.000Z");
    expect(isExpired(hecho, "DEFAULT", unAñoDespués)).toBe(false);
  });

  it("y pasado el plazo deja de verse solo, sin que nadie lo borre", () => {
    const cincoAños = new Date("2031-09-05T00:00:00.000Z");
    expect(isExpired(hecho, "DEFAULT", cincoAños)).toBe(true);
    // El fraude todavía no.
    expect(isExpired(hecho, "FRAUD", cincoAños)).toBe(false);
  });
});
