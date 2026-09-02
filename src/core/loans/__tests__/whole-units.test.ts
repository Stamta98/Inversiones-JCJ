import { describe, expect, it } from "vitest";

import { splitEvenly, stepForDecimals, percentOf, roundToStep } from "../../money";
import { buildSchedule } from "../schedule";

const COLOMBIA = stepForDecimals(0); // 100 = un peso entero
const DOMINICANA = stepForDecimals(2); // 1 = un centavo

/** Un préstamo de 100.000 en 3 cuotas: el caso que no cuadraba. */
function prestamoColombiano(termCount: number, interestRate = 0) {
  return buildSchedule({
    principalCents: 100_000 * 100,
    interestRate,
    interestMethod: "FLAT",
    frequency: "MONTHLY",
    termCount,
    firstDueDate: new Date("2026-03-05T00:00:00.000Z"),
    minorUnitStep: COLOMBIA,
  });
}

describe("el paso mínimo de la moneda", () => {
  it("vale un centavo con dos decimales y una unidad entera sin decimales", () => {
    expect(DOMINICANA).toBe(1);
    expect(COLOMBIA).toBe(100);
  });

  it("redondea a lo que de verdad se puede cobrar", () => {
    expect(roundToStep(3_333_333, COLOMBIA)).toBe(3_333_300);
    expect(roundToStep(3_333_333, DOMINICANA)).toBe(3_333_333);
  });

  it("reparte en unidades enteras sin perder el total", () => {
    const partes = splitEvenly(100_000 * 100, 3, COLOMBIA);
    expect(partes).toEqual([3_333_400, 3_333_300, 3_333_300]);
    // Cada parte es un peso entero.
    for (const parte of partes) expect(parte % COLOMBIA).toBe(0);
    // Y siguen sumando exactamente el capital.
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100_000 * 100);
  });

  it("saca porcentajes que también se pueden cobrar", () => {
    // 10% de 33.333 son 3.333,30 — imposible en pesos colombianos.
    expect(percentOf(33_333 * 100, 10, COLOMBIA) % COLOMBIA).toBe(0);
  });
});

describe("un préstamo en una moneda sin centavos", () => {
  it("reparte 100.000 en 3 cuotas que suman 100.000", () => {
    const plan = prestamoColombiano(3);
    const cuotas = plan.installments.map((i) => i.totalCents / 100);

    expect(cuotas).toEqual([33_334, 33_333, 33_333]);
    expect(cuotas.reduce((a, b) => a + b, 0)).toBe(100_000);
    expect(plan.totalPrincipalCents).toBe(100_000 * 100);
  });

  it("no deja ni una cuota con centavos, en ningún método", () => {
    for (const metodo of ["FLAT", "FRENCH", "GERMAN", "AMERICAN"] as const) {
      const plan = buildSchedule({
        principalCents: 1_750_000 * 100,
        interestRate: 3.5,
        interestMethod: metodo,
        frequency: "BIWEEKLY",
        termCount: 7,
        firstDueDate: new Date("2026-03-05T00:00:00.000Z"),
        minorUnitStep: COLOMBIA,
      });

      for (const cuota of plan.installments) {
        expect(cuota.principalCents % COLOMBIA, `capital en ${metodo}`).toBe(0);
        expect(cuota.interestCents % COLOMBIA, `interés en ${metodo}`).toBe(0);
        expect(cuota.totalCents % COLOMBIA, `total en ${metodo}`).toBe(0);
      }

      // El capital repartido sigue siendo exactamente el prestado.
      expect(plan.totalPrincipalCents, `capital total en ${metodo}`).toBe(
        1_750_000 * 100,
      );
    }
  });

  it("redondea un capital que llega con centavos imposibles", () => {
    // 100.000,40 pesos colombianos no existe; se ajusta antes de repartir.
    const plan = (centavos: number) =>
      buildSchedule({
        principalCents: centavos,
        interestRate: 0,
        interestMethod: "FLAT",
        frequency: "MONTHLY",
        termCount: 2,
        firstDueDate: new Date("2026-03-05T00:00:00.000Z"),
        minorUnitStep: COLOMBIA,
      }).totalPrincipalCents;

    expect(plan(10_000_040)).toBe(10_000_000);
    // Medio peso sube, que es el redondeo de toda la vida para dinero.
    expect(plan(10_000_050)).toBe(10_000_100);
    expect(plan(10_000_040) % COLOMBIA).toBe(0);
  });
});

describe("las monedas con centavos no cambian", () => {
  it("sigue repartiendo al centavo, como antes", () => {
    const plan = buildSchedule({
      principalCents: 100_000 * 100,
      interestRate: 0,
      interestMethod: "FLAT",
      frequency: "MONTHLY",
      termCount: 3,
      firstDueDate: new Date("2026-03-05T00:00:00.000Z"),
      // Sin indicar paso: el comportamiento de siempre.
    });

    const cuotas = plan.installments.map((i) => i.totalCents);
    expect(cuotas).toEqual([3_333_334, 3_333_333, 3_333_333]);
    expect(cuotas.reduce((a, b) => a + b, 0)).toBe(100_000 * 100);
  });
});
