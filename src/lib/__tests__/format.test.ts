/**
 * El formato del dinero, con los idiomas que de verdad hay en la base.
 *
 * `Intl.NumberFormat` no perdona un código mal armado: lanza en vez de
 * apañárselas, y eso tumbó el trabajo por hora entero —mora, promesas y
 * mensajes— porque alguien le pegaba un `-DO` al idioma de la empresa. Con
 * `es-CO` guardado, salía `es-CO-DO`, que no existe.
 */

import { describe, expect, it } from "vitest";

import { formatCurrency } from "../format";

describe("formatCurrency", () => {
  it("formatea pesos colombianos sin decimales", () => {
    // COP no usa centavos: 50.000, no 50.000,00.
    expect(formatCurrency(50000, "COP", "es-CO")).toContain("50.000");
  });

  it("formatea pesos dominicanos", () => {
    expect(formatCurrency(1500.5, "DOP", "es-DO")).toContain("1,500.50");
  });

  it("no revienta con ninguno de los idiomas que hay guardados", () => {
    // Los dos que existen hoy en la base. Si mañana entra otro país, esta
    // prueba es la que avisa antes de que se caiga el trabajo por hora.
    for (const [locale, currency] of [
      ["es-CO", "COP"],
      ["es-DO", "DOP"],
    ] as const) {
      expect(() => formatCurrency(1000, currency, locale)).not.toThrow();
    }
  });

  it("un idioma mal armado lanza — que es lo que pasaba", () => {
    // Se deja escrito el fallo real: pegarle el país a un código que ya lo
    // traía. Sirve de recordatorio de por qué el código va tal cual viene.
    expect(() => formatCurrency(1000, "COP", "es-CO-DO")).toThrow();
  });
});
