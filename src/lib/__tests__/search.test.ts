import { describe, expect, it } from "vitest";

import { forSearch } from "../search";

describe("forSearch", () => {
  it("quita las tildes: quien busca a Peña escribe pena", () => {
    expect(forSearch("Peña")).toBe("pena");
    expect(forSearch("MARÍA JOSÉ")).toBe("maria jose");
  });

  it("junta las partes con un espacio y bota lo que no hay", () => {
    expect(forSearch("Miguel", null, "Cantillo", undefined, "")).toBe(
      "miguel cantillo",
    );
  });

  it("deja los números y los códigos donde se puedan encontrar", () => {
    expect(forSearch("PRE-000023", 1098765432)).toBe("pre-000023 1098765432");
  });

  it("lo tecleado y lo guardado se comparan escritos igual", () => {
    const row = forSearch("Edgar Danilo Pabón", "PRE-000041");
    expect(row.includes(forSearch("pabon"))).toBe(true);
    expect(row.includes(forSearch("PABÓN"))).toBe(true);
    expect(row.includes(forSearch("41"))).toBe(true);
    expect(row.includes(forSearch("zzz"))).toBe(false);
  });

  it("sin nada que buscar, no filtra nada", () => {
    expect(forSearch("")).toBe("");
    expect(forSearch("cualquiera").includes(forSearch(""))).toBe(true);
  });
});
