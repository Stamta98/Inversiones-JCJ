import { describe, expect, it } from "vitest";

import {
  coerceFieldValue,
  formatFieldValue,
  inputTypeFor,
  isValidKey,
  slugifyKey,
} from "../fields";

describe("slugifyKey", () => {
  it("turns a Spanish label into a safe key", () => {
    expect(slugifyKey("Fecha de visita")).toBe("fecha_de_visita");
    expect(slugifyKey("Número de póliza")).toBe("numero_de_poliza");
    expect(slugifyKey("  Garantía  ")).toBe("garantia");
  });

  it("prefixes a key that would not start with a letter", () => {
    expect(slugifyKey("2da referencia")).toBe("campo_2da_referencia");
  });

  it("always produces a valid key", () => {
    for (const label of ["Monto", "¿Tiene vehículo?", "Año/Modelo"]) {
      expect(isValidKey(slugifyKey(label)), label).toBe(true);
    }
  });
});

describe("isValidKey", () => {
  it("rejects keys that are not safe identifiers", () => {
    expect(isValidKey("valid_key1")).toBe(true);
    expect(isValidKey("1invalid")).toBe(false);
    expect(isValidKey("con espacio")).toBe(false);
    expect(isValidKey("Mayuscula")).toBe(false);
    expect(isValidKey("")).toBe(false);
  });
});

describe("coerceFieldValue", () => {
  it("parses numbers and currency", () => {
    expect(coerceFieldValue("NUMBER", "42")).toBe(42);
    expect(coerceFieldValue("CURRENCY", "1250.50")).toBe(1250.5);
    expect(coerceFieldValue("NUMBER", "abc")).toBeNull();
  });

  it("treats an unchecked checkbox as false", () => {
    expect(coerceFieldValue("BOOLEAN", "on")).toBe(true);
    expect(coerceFieldValue("BOOLEAN", null)).toBe(false);
  });

  it("splits a multi select into an array", () => {
    expect(coerceFieldValue("MULTI_SELECT", "a, b ,c")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("stores an empty text field as null", () => {
    expect(coerceFieldValue("TEXT", "   ")).toBeNull();
  });
});

describe("formatFieldValue", () => {
  const options = [
    { value: "casa", label: "Casa propia" },
    { value: "alquiler", label: "Alquilada" },
  ];

  it("resolves a select to its label", () => {
    expect(formatFieldValue("SELECT", "casa", options)).toBe("Casa propia");
  });

  it("joins a multi select", () => {
    expect(formatFieldValue("MULTI_SELECT", ["casa", "alquiler"], options)).toBe(
      "Casa propia, Alquilada",
    );
  });

  it("renders booleans in Spanish", () => {
    expect(formatFieldValue("BOOLEAN", true)).toBe("Sí");
    expect(formatFieldValue("BOOLEAN", false)).toBe("No");
  });

  it("shows a dash when there is nothing", () => {
    expect(formatFieldValue("TEXT", null)).toBe("—");
  });
});

describe("inputTypeFor", () => {
  it("maps types to sensible html inputs", () => {
    expect(inputTypeFor("CURRENCY")).toBe("number");
    expect(inputTypeFor("DATE")).toBe("date");
    expect(inputTypeFor("EMAIL")).toBe("email");
    expect(inputTypeFor("LONG_TEXT")).toBe("text");
  });
});
