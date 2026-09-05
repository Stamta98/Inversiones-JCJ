import { describe, expect, it } from "vitest";

import { firstDueAfter } from "../dates";

/** El día que se entrega la plata no se cobra: se cobra un período después. */
describe("firstDueAfter", () => {
  // 5 de septiembre de 2026 es un sábado.
  const sábado = new Date("2026-09-05T00:00:00.000Z");
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  it("diario: prestado hoy, la primera cuota es mañana", () => {
    expect(iso(firstDueAfter(sábado, "DAILY"))).toBe("2026-09-06");
  });

  it("semanal: prestado el sábado, la primera es el sábado de la otra semana", () => {
    expect(iso(firstDueAfter(sábado, "WEEKLY"))).toBe("2026-09-12");
  });

  it("quincenal: dos semanas después", () => {
    expect(iso(firstDueAfter(sábado, "BIWEEKLY"))).toBe("2026-09-19");
  });

  it("mensual: el mismo día del mes que viene", () => {
    expect(iso(firstDueAfter(sábado, "MONTHLY"))).toBe("2026-10-05");
  });

  it("cada tantos días: los que se hayan puesto", () => {
    expect(iso(firstDueAfter(sábado, "CUSTOM", { customIntervalDays: 10 }))).toBe(
      "2026-09-15",
    );
  });

  it("nunca cae el mismo día en que se entregó", () => {
    for (const frecuencia of [
      "DAILY",
      "EVERY_OTHER_DAY",
      "TWICE_WEEKLY",
      "WEEKLY",
      "BIWEEKLY",
      "SEMIMONTHLY",
      "MONTHLY",
      "QUARTERLY",
      "YEARLY",
      // Pago único: tampoco se cobra el mismo día.
      "SINGLE",
    ] as const) {
      expect(iso(firstDueAfter(sábado, frecuencia))).not.toBe("2026-09-05");
    }
  });

  it("si cae en un día que no se cobra, se corre al siguiente que sí", () => {
    // Diario prestado el sábado caería en domingo; sin domingos, va al lunes.
    expect(iso(firstDueAfter(sábado, "DAILY", { nonCollectionDays: [0] }))).toBe(
      "2026-09-07",
    );
    // Y si tampoco se cobra el lunes, al martes.
    expect(
      iso(firstDueAfter(sábado, "DAILY", { nonCollectionDays: [0, 1] })),
    ).toBe("2026-09-08");
  });
});
