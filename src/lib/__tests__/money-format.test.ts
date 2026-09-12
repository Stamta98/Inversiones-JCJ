import { describe, expect, it } from "vitest";

import { decimalMark, readAmount, showAmount } from "../money-format";

const CO = "es-CO";
const US = "en-US";

describe("decimalMark", () => {
  it("es la coma en español y el punto en inglés", () => {
    expect(decimalMark(CO)).toBe(",");
    expect(decimalMark(US)).toBe(".");
  });
});

describe("showAmount", () => {
  it("agrupa los miles del peso colombiano", () => {
    expect(showAmount("30000", 0, CO)).toBe("30.000");
    expect(showAmount("1250000", 0, CO)).toBe("1.250.000");
  });

  it("deja el campo vacío en blanco", () => {
    expect(showAmount("", 0, CO)).toBe("");
  });

  it("no inventa decimales donde la moneda no los tiene", () => {
    expect(showAmount("30000.50", 0, CO)).toBe("30.000");
  });

  it("escribe los decimales con la marca del locale", () => {
    expect(showAmount("1250.75", 2, CO)).toBe("1.250,75");
    expect(showAmount("1250.75", 2, US)).toBe("1,250.75");
  });

  it("no rellena los decimales a medio escribir", () => {
    // Quien va tecleando «1250,» tiene que poder seguir con el 7.
    expect(showAmount("1250.", 2, CO)).toBe("1.250,");
    expect(showAmount("1250.7", 2, CO)).toBe("1.250,7");
  });
});

describe("readAmount", () => {
  it("bota los puntos de miles que el propio campo pintó", () => {
    expect(readAmount("30.000", 0, CO)).toBe("30000");
    expect(readAmount("1.250.000", 0, CO)).toBe("1250000");
  });

  it("se queda solo con los dígitos", () => {
    expect(readAmount("$ 30.000 pesos", 0, CO)).toBe("30000");
    expect(readAmount("abc", 0, CO)).toBe("");
  });

  it("en pesos colombianos el punto es de miles, nunca de centavos", () => {
    expect(readAmount("30.5", 0, CO)).toBe("305");
  });

  it("guarda la marca decimal donde la moneda sí lleva decimales", () => {
    expect(readAmount("1.250,75", 2, CO)).toBe("1250.75");
    expect(readAmount("1,250.75", 2, US)).toBe("1250.75");
  });

  it("conserva la coma recién tecleada", () => {
    expect(readAmount("1250,", 2, CO)).toBe("1250.");
  });

  it("corta la fracción a los decimales de la moneda", () => {
    expect(readAmount("1250,7599", 2, CO)).toBe("1250.75");
  });

  it("no deja ceros de más a la izquierda", () => {
    expect(readAmount("030000", 0, CO)).toBe("30000");
    expect(readAmount("0", 0, CO)).toBe("0");
  });

  it("con dos comas, la última manda", () => {
    expect(readAmount("1,250,75", 2, CO)).toBe("1250.75");
  });

  it("ida y vuelta deja el número igual", () => {
    for (const raw of ["0", "5", "30000", "1250000"]) {
      expect(readAmount(showAmount(raw, 0, CO), 0, CO)).toBe(raw);
    }
    for (const raw of ["1250.75", "0.05"]) {
      expect(readAmount(showAmount(raw, 2, CO), 2, CO)).toBe(raw);
    }
  });
});
