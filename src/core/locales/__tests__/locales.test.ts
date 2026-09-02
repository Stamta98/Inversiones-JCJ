import { describe, expect, it } from "vitest";

import {
  CURRENCIES,
  defaultDecimalsFor,
  findCurrency,
  isSupportedCurrency,
} from "../currencies";
import { COUNTRIES, defaultsForCountry, findCountry } from "../countries";

describe("monedas", () => {
  it("encuentra una moneda sin importar mayúsculas ni espacios", () => {
    expect(findCurrency(" cop ")?.name).toBe("Peso colombiano");
    expect(findCurrency("DOP")?.symbol).toBe("RD$");
    expect(findCurrency("XXX")).toBeNull();
    expect(isSupportedCurrency("CLP")).toBe(true);
  });

  it("da cero decimales donde no se usan centavos", () => {
    // Es el punto de todo el catálogo: en Colombia y Chile los montos se
    // escriben enteros, y mostrar centavos siempre en cero se lee como error.
    expect(defaultDecimalsFor("COP")).toBe(0);
    expect(defaultDecimalsFor("CLP")).toBe(0);
    expect(defaultDecimalsFor("PYG")).toBe(0);
  });

  it("da dos decimales donde sí se usan", () => {
    expect(defaultDecimalsFor("DOP")).toBe(2);
    expect(defaultDecimalsFor("MXN")).toBe(2);
    expect(defaultDecimalsFor("USD")).toBe(2);
  });

  it("cae en dos decimales para un código desconocido", () => {
    // Ocultar centavos que valen es peor que mostrar centavos en cero.
    expect(defaultDecimalsFor("ZZZ")).toBe(2);
  });

  it("no tiene códigos repetidos", () => {
    const codes = CURRENCIES.map((currency) => currency.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("países", () => {
  it("prellena lo que se deduce de elegir el país", () => {
    expect(defaultsForCountry("CO")).toEqual({
      currencyCode: "COP",
      locale: "es-CO",
      timezone: "America/Bogota",
      stateLabel: "Departamento",
      phoneCode: "57",
    });
  });

  it("usa el nombre local de la división administrativa", () => {
    expect(findCountry("DO")?.stateLabel).toBe("Provincia");
    expect(findCountry("MX")?.stateLabel).toBe("Estado");
    expect(findCountry("CL")?.stateLabel).toBe("Región");
  });

  it("devuelve null para un país que no está", () => {
    expect(defaultsForCountry("FR")).toBeNull();
  });

  it("apunta solo a monedas del catálogo", () => {
    for (const country of COUNTRIES) {
      expect(isSupportedCurrency(country.currencyCode)).toBe(true);
    }
  });
});
