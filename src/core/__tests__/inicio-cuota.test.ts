import { describe, expect, it } from "vitest";

import { firstDueAfter, startForFirstDue } from "../dates";
import type { PaymentFrequency } from "../types";

/**
 * El formulario pregunta cuándo empieza el préstamo y de ahí saca la primera
 * cuota. Al abrir uno ya hecho hay que hacer el camino contrario para llenar
 * la casilla, y ese camino tiene que devolver al mismo sitio: si no, abrir un
 * préstamo y guardarlo sin tocar nada le movería el plan.
 */
const dia = (d: Date) => d.toISOString().slice(0, 10);

describe("la primera cuota sale del día de inicio", () => {
  const inicio = new Date("2026-09-06T00:00:00.000Z"); // domingo

  it("diario: se cobra al día siguiente", () => {
    expect(dia(firstDueAfter(inicio, "DAILY"))).toBe("2026-09-07");
  });

  it("semanal: se cobra el mismo día de la otra semana", () => {
    expect(dia(firstDueAfter(inicio, "WEEKLY"))).toBe("2026-09-13");
  });

  it("quincenal: catorce días después", () => {
    expect(dia(firstDueAfter(inicio, "BIWEEKLY"))).toBe("2026-09-20");
  });

  it("mensual: el mismo día del mes que viene", () => {
    expect(dia(firstDueAfter(inicio, "MONTHLY"))).toBe("2026-10-06");
  });

  it("y nunca el mismo día en que se entregó", () => {
    for (const f of ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const) {
      expect(dia(firstDueAfter(inicio, f))).not.toBe(dia(inicio));
    }
  });
});

describe("volver del día de la cuota al de inicio", () => {
  const REDONDAS: PaymentFrequency[] = [
    "DAILY",
    "EVERY_OTHER_DAY",
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
  ];

  it("devuelve al mismo sitio en las frecuencias de verdad", () => {
    const inicio = new Date("2026-09-06T00:00:00.000Z");
    for (const f of REDONDAS) {
      const cuota = firstDueAfter(inicio, f);
      const vuelta = startForFirstDue(cuota, f);
      expect(dia(firstDueAfter(vuelta, f))).toBe(dia(cuota));
    }
  });

  it("también con un intervalo escogido a mano", () => {
    const inicio = new Date("2026-09-06T00:00:00.000Z");
    const cuota = firstDueAfter(inicio, "CUSTOM", { customIntervalDays: 10 });
    expect(dia(cuota)).toBe("2026-09-16");
    const vuelta = startForFirstDue(cuota, "CUSTOM", { customIntervalDays: 10 });
    expect(dia(vuelta)).toBe("2026-09-06");
  });

  it("y con días que no se cobran, sin correr la cuota otra vez", () => {
    // Domingo sin cobro: la cuota del semanal cae en domingo y se corre al
    // lunes; volver atrás y adelantar tiene que dejarla en el mismo lunes.
    const inicio = new Date("2026-09-06T00:00:00.000Z");
    const cuota = firstDueAfter(inicio, "WEEKLY", { nonCollectionDays: [0] });
    expect(dia(cuota)).toBe("2026-09-14");
    const vuelta = startForFirstDue(cuota, "WEEKLY");
    expect(dia(firstDueAfter(vuelta, "WEEKLY", { nonCollectionDays: [0] }))).toBe(
      "2026-09-14",
    );
  });
});
