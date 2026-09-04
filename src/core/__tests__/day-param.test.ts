import { describe, expect, it } from "vitest";

import { dayParam, parseDay } from "../dates";

describe("parseDay", () => {
  it("lee el día que viene en la dirección", () => {
    expect(parseDay("2026-08-05")).toEqual(new Date(Date.UTC(2026, 7, 5)));
  });

  it("no acepta lo que no es una fecha", () => {
    for (const value of ["", "hoy", "2026-8-5", "05/08/2026", undefined, null]) {
      expect(parseDay(value)).toBeNull();
    }
  });

  // Un 31 de febrero rodaría solo hasta marzo y el resumen mostraría un día
  // que nadie pidió.
  it("no acepta días que no existen", () => {
    expect(parseDay("2026-02-31")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("2026-00-10")).toBeNull();
  });

  it("va y vuelve igual", () => {
    expect(dayParam(parseDay("2026-08-05")!)).toBe("2026-08-05");
  });
});
