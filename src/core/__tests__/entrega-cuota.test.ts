import { describe, expect, it } from "vitest";

import { dayIn } from "../dates";

/**
 * Quién cobra el día en que se entregó la plata.
 *
 * La regla parece "la primera cuota es anterior o igual a la entrega", y no
 * lo es: tiene que ser **el mismo día**. Una cuota anterior a la entrega no
 * es un préstamo torcido sino uno que ya venía andando en la calle cuando se
 * digitó — la fecha de entrega es el día en que se pasó a la aplicación y las
 * cuotas son de antes. Correrle el plan a ese le movería las fechas de verdad
 * hasta después de haberlo digitado.
 */

/** La misma comparación de `chargesOnDeliveryDay`, sin la base de por medio. */
const mismoDia = (primeraCuota: string, entrega: string, zona: string) =>
  dayIn(new Date(primeraCuota), "UTC").getTime() ===
  dayIn(new Date(entrega), zona).getTime();

describe("cobrar el día de la entrega", () => {
  const BOGOTA = "America/Bogota";

  it("lo marca cuando la primera cuota es el día de la entrega", () => {
    expect(
      mismoDia("2026-08-11T00:00:00.000Z", "2026-08-11T15:00:00.000Z", BOGOTA),
    ).toBe(true);
  });

  it("no lo marca cuando la cuota cae el día siguiente", () => {
    expect(
      mismoDia("2026-08-12T00:00:00.000Z", "2026-08-11T15:00:00.000Z", BOGOTA),
    ).toBe(false);
  });

  it("no marca un préstamo que ya venía andando cuando se digitó", () => {
    // Entregado —digitado— el 5 de septiembre, con cuotas desde el 17 de
    // agosto: es un traspaso, no un error.
    expect(
      mismoDia("2026-08-17T00:00:00.000Z", "2026-09-05T15:00:00.000Z", BOGOTA),
    ).toBe(false);
  });

  it("mira el día de la oficina, no el de UTC", () => {
    // Ocho y media de la noche del 10 en Bogotá, que en UTC es el 11.
    const entrega = "2026-08-11T01:30:00.000Z";
    expect(mismoDia("2026-08-10T00:00:00.000Z", entrega, BOGOTA)).toBe(true);
    expect(mismoDia("2026-08-11T00:00:00.000Z", entrega, BOGOTA)).toBe(false);
  });

  it("sirve igual al otro lado del meridiano", () => {
    // Medianoche pasada en Madrid: allá ya es el 11.
    const entrega = "2026-08-10T22:00:00.000Z";
    expect(mismoDia("2026-08-11T00:00:00.000Z", entrega, "Europe/Madrid")).toBe(true);
  });
});
