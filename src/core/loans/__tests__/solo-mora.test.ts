import { describe, expect, it } from "vitest";

import { allocatePayment } from "../allocation";

/**
 * Cobrar solo la mora.
 *
 * El cliente paga lo que se le sumó por atrasarse y la cuota se queda como
 * estaba, esperando su plata. Es otra cosa que abonar a la cuota, donde la
 * mora es lo primero que se cubre y lo que sobra sigue bajando el interés y
 * el capital.
 */
const cuota = (n: number, mora: number, pagado = 0) => ({
  id: `c${n}`,
  number: n,
  dueDate: new Date(`2026-09-0${n}T00:00:00.000Z`),
  principalCents: 100_00,
  interestCents: 20_00,
  chargeCents: 10_00,
  lateFeeCents: mora,
  paidCents: pagado,
  status: "PENDING" as const,
});

describe("cobrar solo la mora", () => {
  it("toca la mora y no toca nada más", () => {
    const r = allocatePayment(500_00, [cuota(1, 30_00)], "LATE_FEE");
    expect(r.allocations).toHaveLength(1);
    const a = r.allocations[0];
    expect(a.lateFeeCents).toBe(30_00);
    expect(a.chargeCents).toBe(0);
    expect(a.interestCents).toBe(0);
    expect(a.principalCents).toBe(0);
  });

  it("no aplica más de la mora que se debe, por mucho que le den", () => {
    const r = allocatePayment(500_00, [cuota(1, 30_00)], "LATE_FEE");
    expect(r.appliedCents).toBe(30_00);
    expect(r.unappliedCents).toBe(470_00);
  });

  it("va cuota por cuota, de la más vieja a la más nueva", () => {
    const r = allocatePayment(
      45_00,
      [cuota(2, 20_00), cuota(1, 30_00)],
      "LATE_FEE",
    );
    expect(r.allocations.map((a) => [a.installmentNumber, a.lateFeeCents]))
      .toEqual([
        [1, 30_00],
        [2, 15_00],
      ]);
  });

  it("la cuota no queda saldada aunque su mora quede en cero", () => {
    const r = allocatePayment(30_00, [cuota(1, 30_00)], "LATE_FEE");
    expect(r.allocations[0].resultingStatus).toBe("PARTIALLY_PAID");
  });

  it("sin mora que cobrar no aplica nada", () => {
    const r = allocatePayment(100_00, [cuota(1, 0)], "LATE_FEE");
    expect(r.allocations).toHaveLength(0);
    expect(r.appliedCents).toBe(0);
  });

  it("no vuelve a cobrar la mora que ya se había pagado", () => {
    // La cuota lleva 30 pagados, que es justo su mora: no queda mora que
    // cobrar aunque el resto de la cuota siga debiéndose.
    const r = allocatePayment(100_00, [cuota(1, 30_00, 30_00)], "LATE_FEE");
    expect(r.appliedCents).toBe(0);
  });

  it("abonar a la cuota sigue repartiendo entre todo, como siempre", () => {
    const r = allocatePayment(160_00, [cuota(1, 30_00)]);
    const a = r.allocations[0];
    expect([a.lateFeeCents, a.chargeCents, a.interestCents, a.principalCents])
      .toEqual([30_00, 10_00, 20_00, 100_00]);
    expect(a.resultingStatus).toBe("PAID");
  });
});
