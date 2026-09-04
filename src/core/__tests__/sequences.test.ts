import { describe, expect, it } from "vitest";

import { formatCode, nextCode } from "../sequences";

describe("nextCode", () => {
  it("starts at one when there is nothing yet", () => {
    expect(nextCode("PRE", null)).toBe("PRE-000001");
    expect(nextCode("REC", undefined)).toBe("REC-000001");
  });

  it("follows the highest code there is", () => {
    expect(nextCode("PRE", "PRE-000045")).toBe("PRE-000046");
    expect(nextCode("REC", "REC-001045")).toBe("REC-001046");
  });

  // Lo que hacía falta arreglar: contar filas parece equivalente y no lo es.
  // Borrado el préstamo 3 de 4, contar daría PRE-000004, que ya existe.
  it("does not reissue a code after something was deleted", () => {
    expect(nextCode("PRE", "PRE-000004")).toBe("PRE-000005");
  });

  it("carries past the padding without breaking", () => {
    expect(nextCode("PRE", "PRE-999999")).toBe("PRE-1000000");
  });

  // Un código de otro sistema no puede decidir el siguiente; la unicidad de la
  // base de datos es la que manda.
  it("starts over on a code it cannot read", () => {
    expect(nextCode("PRE", "sin-numero")).toBe("PRE-000001");
  });
});

describe("formatCode", () => {
  it("pads to six figures", () => {
    expect(formatCode("PRE", 7)).toBe("PRE-000007");
  });
});
