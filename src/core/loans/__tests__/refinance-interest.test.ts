import { describe, expect, it } from "vitest";

import type { MinorUnitStep } from "../../money";
import { buildSchedule } from "../schedule";

/** Pesos colombianos: sin centavos, así que todo cae en unidades enteras. */
const COP: MinorUnitStep = 100;

/**
 * El caso de la calle: se refinancian 700.000, se le cobran 35.000 por
 * hacerlo y el cargo queda dentro de la deuda. El cliente quedó debiendo
 * 735.000 y el 20% se acordó sobre esos 735.000.
 */
const REFINANCE = {
  principalCents: 700_000 * COP,
  interestRate: 20,
  rateBasis: "TOTAL" as const,
  interestMethod: "FLAT" as const,
  frequency: "DAILY" as const,
  termCount: 30,
  firstDueDate: new Date(Date.UTC(2026, 0, 5)),
  minorUnitStep: COP,
  financedChargeCents: 35_000 * COP,
};

describe("interés sobre la deuda con el cargo adentro", () => {
  it("cobra el 20% de 735.000, no el de 700.000", () => {
    const schedule = buildSchedule({
      ...REFINANCE,
      interestBaseCents: 735_000 * COP,
    });

    expect(schedule.totalInterestCents).toBe(147_000 * COP);
    expect(schedule.totalChargeCents).toBe(35_000 * COP);
    expect(schedule.totalPrincipalCents).toBe(700_000 * COP);
    expect(schedule.totalToPayCents).toBe(882_000 * COP);
  });

  it("deja las treinta cuotas iguales, en 29.400", () => {
    const schedule = buildSchedule({
      ...REFINANCE,
      interestBaseCents: 735_000 * COP,
    });

    const totals = new Set(schedule.installments.map((one) => one.totalCents));
    expect([...totals]).toEqual([29_400 * COP]);
  });

  it("sin decirlo, el interés sigue corriendo sobre el capital solo", () => {
    const schedule = buildSchedule(REFINANCE);

    expect(schedule.totalInterestCents).toBe(140_000 * COP);
    expect(schedule.totalToPayCents).toBe(875_000 * COP);
  });
});

describe("el cargo financiado no descuadra la cuota", () => {
  /**
   * Repartir el cargo aparte del resto dejaba 29.401 en unas cuotas y 29.399
   * en otras: cada mitad se redondeaba sola. La cuota de un préstamo de calle
   * es un número acordado y tiene que salir una sola.
   */
  it("reparte el total entero, no cada parte por su lado", () => {
    const schedule = buildSchedule({
      ...REFINANCE,
      principalCents: 100_000 * COP,
      termCount: 7,
      financedChargeCents: 5_000 * COP,
    });

    const totals = schedule.installments.map((one) => one.totalCents);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(COP);
    expect(totals.reduce((sum, one) => sum + one, 0)).toBe(
      schedule.totalToPayCents,
    );
  });

  it("el plan de cuota decreciente sigue decreciendo", () => {
    const schedule = buildSchedule({
      ...REFINANCE,
      interestMethod: "GERMAN",
      rateBasis: "PER_PERIOD",
      interestRate: 2,
      termCount: 6,
      financedChargeCents: 6_000 * COP,
    });

    const totals = schedule.installments.map((one) => one.totalCents);
    for (let index = 1; index < totals.length; index += 1) {
      expect(totals[index]!).toBeLessThanOrEqual(totals[index - 1]!);
    }
    expect(schedule.totalChargeCents).toBe(6_000 * COP);
  });
});
