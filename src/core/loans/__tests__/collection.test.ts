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

  // El cliente pregunta "¿cuánto llevo atrasado?" y la respuesta se cuenta
  // desde la cuota más vieja que se quedó sin pagar, no desde la última.
  it("cuenta el atraso desde la cuota más vieja sin pagar", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 3), installment(2, 8), installment(3, 12)],
      TODAY,
    );

    expect(snapshot.daysLate).toBe(7);
    expect(snapshot.overdueCount).toBe(2);
    expect(snapshot.overdueSince).toEqual(new Date(2026, 8, 3));
  });

  // La de hoy todavía se cobra hoy: entra en lo que hay que cobrar, pero
  // decirle al cliente que lleva un día de atraso sería mentirle.
  it("la cuota de hoy no cuenta como atraso", () => {
    const snapshot = collectionSnapshot([installment(1, 10)], TODAY);

    expect(snapshot.daysLate).toBe(0);
    expect(snapshot.overdueCount).toBe(0);
    expect(snapshot.overdueSince).toBeNull();
    expect(snapshot.overdueCents).toBe(4_000_000);
  });

  it("una cuota vencida pero ya cubierta no deja atraso", () => {
    const snapshot = collectionSnapshot(
      [
        installment(1, 3, { paidCents: 4_000_000, status: "PARTIALLY_PAID" }),
        installment(2, 12),
      ],
      TODAY,
    );

    expect(snapshot.daysLate).toBe(0);
    expect(snapshot.overdueCount).toBe(0);
  });

  // Lo que se propone al cobrar es la cuota entera, la que el cliente conoce,
  // aunque de esa cuota ya haya abonado una parte.
  it("propone la cuota completa aunque ya tenga un abono", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 12, { paidCents: 1_500_000, status: "PARTIALLY_PAID" })],
      TODAY,
    );

    expect(snapshot.installmentCents).toBe(4_000_000);
    expect(snapshot.nextAmountCents).toBe(2_500_000);
  });

  it("no propone cuota cuando ya no queda ninguna", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 5, { status: "PAID" })],
      TODAY,
    );

    expect(snapshot.installmentCents).toBe(0);
  });

  // Lo que se atrasa son cuotas; lo que se vence es el crédito. Un cliente
  // puede llevar dos cuotas atrasadas y que el crédito no se haya vencido.
  it("no cuenta días vencidos mientras el crédito no se acabe", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 3), installment(2, 8), installment(3, 20)],
      TODAY,
    );

    expect(snapshot.overdueCount).toBe(2);
    expect(snapshot.daysExpired).toBe(0);
    expect(snapshot.lastDueDate).toEqual(new Date(2026, 8, 20));
  });

  it("cuenta los días desde que se venció el crédito", () => {
    const snapshot = collectionSnapshot(
      [installment(1, 3), installment(2, 9)],
      TODAY,
    );

    expect(snapshot.daysExpired).toBe(1);
    expect(snapshot.overdueCount).toBe(2);
  });

  it("un crédito saldado no se vence", () => {
    const snapshot = collectionSnapshot(
      [
        installment(1, 3, { status: "PAID" }),
        installment(2, 9, { status: "PAID" }),
      ],
      TODAY,
    );

    expect(snapshot.daysExpired).toBe(0);
    expect(snapshot.lastDueDate).toEqual(new Date(2026, 8, 9));
  });

  it("el crédito que se acaba hoy todavía no está vencido", () => {
    const snapshot = collectionSnapshot([installment(1, 10)], TODAY);

    expect(snapshot.daysExpired).toBe(0);
  });

  it("aguanta un préstamo sin cuotas", () => {
    const snapshot = collectionSnapshot([], TODAY);

    expect(snapshot).toMatchObject({ paidCount: 0, kind: "settled" });
  });
});
