import { describe, expect, it } from "vitest";

import {
  ChargeError,
  cashHandedOver,
  normalizeCharge,
  summarizeCharges,
  type Charge,
} from "../charges";
import { buildSchedule } from "../schedule";

const charge = (
  name: string,
  amountCents: number,
  mode: Charge["mode"],
): Charge => ({ name, amountCents, mode });

describe("normalizeCharge", () => {
  it("tidies the name", () => {
    expect(
      normalizeCharge({
        name: "  Estudio   de crédito ",
        amountCents: 500_000,
        mode: "DEDUCTED",
      }).name,
    ).toBe("Estudio de crédito");
  });

  it("refuses a charge with no name", () => {
    for (const name of ["", "   "]) {
      try {
        normalizeCharge({ name, amountCents: 500_000, mode: "DEDUCTED" });
        throw new Error("should have refused");
      } catch (error) {
        expect((error as ChargeError).code).toBe("name");
      }
    }
  });

  it("refuses a charge with no money in it", () => {
    for (const amountCents of [0, -100]) {
      try {
        normalizeCharge({ name: "Papelería", amountCents, mode: "DEDUCTED" });
        throw new Error("should have refused");
      } catch (error) {
        expect((error as ChargeError).code).toBe("amount");
      }
    }
  });

  // Un cargo de 5.000,49 en pesos no se puede cobrar.
  it("rounds to what the currency can charge", () => {
    expect(
      normalizeCharge(
        { name: "Papelería", amountCents: 500_049, mode: "DEDUCTED" },
        100,
      ).amountCents,
    ).toBe(500_000);
  });
});

describe("summarizeCharges", () => {
  it("keeps the two kinds apart", () => {
    const summary = summarizeCharges([
      charge("Papelería", 500_000, "DEDUCTED"),
      charge("Estudio", 300_000, "DEDUCTED"),
      charge("Seguro", 200_000, "FINANCED"),
    ]);

    expect(summary.deductedCents).toBe(800_000);
    expect(summary.financedCents).toBe(200_000);
    expect(summary.totalCents).toBe(1_000_000);
  });

  it("is all zeros with no charges", () => {
    expect(summarizeCharges([])).toEqual({
      deductedCents: 0,
      financedCents: 0,
      totalCents: 0,
    });
  });
});

describe("cashHandedOver", () => {
  // El ejemplo del prestamista: presta 100.000, cobra 5.000, entrega 95.000.
  it("takes the deducted charge off what the customer receives", () => {
    expect(cashHandedOver(10_000_000, 500_000)).toBe(9_500_000);
  });

  it("hands over the whole loan when nothing is deducted", () => {
    expect(cashHandedOver(10_000_000, 0)).toBe(10_000_000);
  });

  // Entregar cero y quedar debiendo no es un préstamo.
  it("refuses charges that would eat the whole loan", () => {
    for (const deducted of [10_000_000, 12_000_000]) {
      try {
        cashHandedOver(10_000_000, deducted);
        throw new Error("should have refused");
      } catch (error) {
        expect((error as ChargeError).code).toBe("overPrincipal");
      }
    }
  });
});

// El ejemplo del prestamista, extremo a extremo por el motor de cuotas:
// presta 100.000 al 20% a 30 días con un cargo de 5.000.
describe("un cargo financiado en el plan de cuotas", () => {
  const plan = (financedChargeCents: number) =>
    buildSchedule({
      principalCents: 10_000_000,
      interestRate: 20,
      rateBasis: "TOTAL",
      interestMethod: "FLAT",
      frequency: "DAILY",
      termCount: 30,
      firstDueDate: new Date(2026, 8, 3),
      minorUnitStep: 100,
      financedChargeCents,
    });

  it("suma el cargo al total, sin cobrarle interés", () => {
    const withCharge = plan(500_000);

    expect(withCharge.totalPrincipalCents).toBe(10_000_000);
    expect(withCharge.totalInterestCents).toBe(2_000_000);
    expect(withCharge.totalChargeCents).toBe(500_000);
    // 100.000 + 20.000 + 5.000 = 125.000, no 126.000.
    expect(withCharge.totalToPayCents).toBe(12_500_000);
  });

  it("reparte el cargo entre las cuotas y estas siguen sumando el total", () => {
    const withCharge = plan(500_000);
    const sum = withCharge.installments.reduce(
      (total, installment) => total + installment.totalCents,
      0,
    );

    expect(sum).toBe(12_500_000);
    expect(
      withCharge.installments.reduce((t, i) => t + i.chargeCents, 0),
    ).toBe(500_000);
  });

  it("deja el plan igual que siempre cuando no hay cargo", () => {
    const plain = plan(0);

    expect(plain.totalChargeCents).toBe(0);
    expect(plain.totalToPayCents).toBe(12_000_000);
    expect(plain.installments.every((i) => i.chargeCents === 0)).toBe(true);
  });
});

// El cargo descontado no es plata nueva: es plata que no se entregó. Contarla
// como si hubiera entrado además de restarla del desembolso dejaría la caja
// diciendo una cosa y el cajón otra.
describe("lo que sale de la caja", () => {
  it("un cargo de cero no estorba, ni siquiera sin nada que entregar", () => {
    expect(cashHandedOver(0, 0)).toBe(0);
    expect(cashHandedOver(10_000_000, 0)).toBe(10_000_000);
  });

  it("una refinanciación no puede llevar cargos descontados", () => {
    try {
      // Una refinanciación no entrega nada, así que no hay de dónde sacarlo.
      cashHandedOver(0, 500_000);
      throw new Error("should have refused");
    } catch (error) {
      expect((error as ChargeError).code).toBe("overPrincipal");
    }
  });
});
