import { describe, expect, it } from "vitest";

import { collectionSnapshot, type CollectableInstallment } from "../collection";

const TODAY = new Date(2026, 8, 10);

const installment = (
  number: number,
  day: number,
  overrides: Partial<CollectableInstallment> = {},
): CollectableInstallment => ({
  number,
  dueDate: new Date(2026, 8, day),
  totalCents: 4_000_000,
  paidCents: 0,
  status: "PENDING",
  ...overrides,
});

describe("collectionSnapshot", () => {
  // Lo que el cobrador pide en la puerta cuando el cliente viene al día es la
  // cuota que sigue, no el saldo entero.
  it("pide la próxima cuota cuando no hay atraso", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 12), installment(2, 13)],
      TODAY,
    );

    expect(snapshot.kind).toBe("upcoming");
    expect(snapshot.amountCents).toBe(4_000_000);
    expect(snapshot.overdueCents).toBe(0);
    expect(snapshot.nextDueDate).toEqual(new Date(2026, 8, 12));
  });

  // Y cuando viene atrasado, todo lo que se acumuló, no una cuota.
  it("suma lo vencido cuando el cliente viene atrasado", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 7), installment(2, 8), installment(3, 12)],
      TODAY,
    );

    expect(snapshot.kind).toBe("overdue");
    expect(snapshot.overdueCents).toBe(8_000_000);
    expect(snapshot.amountCents).toBe(8_000_000);
  });

  it("descuenta lo que ya se abonó a la cuota vencida", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 7, { paidCents: 1_500_000, status: "PARTIALLY_PAID" })],
      TODAY,
    );

    expect(snapshot.overdueCents).toBe(2_500_000);
  });

  it("cuenta las cuotas pagadas para el avance", () => {
    const snapshot = collectionSnapshot(
      [
        installment(1, 5, { status: "PAID" }),
        installment(2, 6, { status: "WAIVED" }),
        installment(3, 12),
      ],
      TODAY,
    );

    expect(snapshot.paidCount).toBe(2);
  });

  it("no pide nada cuando ya está saldado", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 5, { status: "PAID" })],
      TODAY,
    );

    expect(snapshot.kind).toBe("settled");
    expect(snapshot.amountCents).toBe(0);
    expect(snapshot.nextDueDate).toBeNull();
  });

  it("una cuota que vence hoy ya se cobra", () => {
    const snapshot = collectionSnapshot([installment(1, 10)], TODAY);

    expect(snapshot.kind).toBe("overdue");
    expect(snapshot.overdueCents).toBe(4_000_000);
  });

  it("aguanta un préstamo sin cuotas", () => {
    const snapshot = collectionSnapshot([], TODAY);

    expect(snapshot).toMatchObject({ paidCount: 0, kind: "settled" });
  });
});
