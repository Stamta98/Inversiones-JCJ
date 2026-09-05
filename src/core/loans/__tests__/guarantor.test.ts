import { describe, expect, it } from "vitest";

import { guarantorProblem } from "../guarantor";

/**
 * Las dos reglas del fiador que la base no sostiene sola: la llave foránea
 * acepta al cliente de otra oficina y acepta al mismo que pide la plata.
 */
describe("quién puede salir de fiador", () => {
  it("puede no haber ninguno: no es obligatorio", () => {
    expect(guarantorProblem(null, "ana", false)).toBeNull();
    expect(guarantorProblem(undefined, "ana", false)).toBeNull();
    expect(guarantorProblem("", "ana", false)).toBeNull();
  });

  it("no puede ser el mismo que pide la plata", () => {
    expect(guarantorProblem("ana", "ana", true)).toBe("guarantorIsBorrower");
  });

  it("no puede ser un cliente que no es de esta oficina", () => {
    expect(guarantorProblem("beto", "ana", false)).toBe("guarantorNotFound");
  });

  it("sirve cuando es otro cliente de la misma oficina", () => {
    expect(guarantorProblem("beto", "ana", true)).toBeNull();
  });

  it("al que se pone a sí mismo le dice el motivo verdadero", () => {
    // Aunque además no se hubiera encontrado, lo que hay que oír es que el
    // fiador tiene que ser otra persona.
    expect(guarantorProblem("ana", "ana", false)).toBe("guarantorIsBorrower");
  });
});
