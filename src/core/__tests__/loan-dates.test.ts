import { describe, expect, it } from "vitest";

import { dayIn } from "../dates";
import { buildSchedule } from "../loans/schedule";
import { collectionSnapshot } from "../loans/collection";

/**
 * De cuándo a cuándo va un préstamo.
 *
 * Las dos fechas que salen en la tarjeta del préstamo — cuándo inició y
 * cuándo vence — venían de dos sitios distintos y ninguno de los dos era el
 * bueno: la entrega es una hora, no un día, y la primera cuota guardada no
 * era la del plan cuando el día escogido no se cobraba.
 */
describe("el día en que se entregó la plata", () => {
  it("es el del reloj de la oficina, no el de UTC", () => {
    // Ocho y media de la noche del 10 de agosto en Bogotá.
    const entregado = new Date("2026-08-11T01:30:00.000Z");

    expect(dayIn(entregado, "America/Bogota").toISOString().slice(0, 10)).toBe(
      "2026-08-10",
    );
    // Leído en UTC —  como se pintaba antes — el préstamo "iniciaba" un día
    // después de que salió la plata.
    expect(entregado.toISOString().slice(0, 10)).toBe("2026-08-11");
  });

  it("no mueve la fecha cuando se entregó de día", () => {
    const entregado = new Date("2026-08-11T15:00:00.000Z"); // 10 a.m. Bogotá
    expect(dayIn(entregado, "America/Bogota").toISOString().slice(0, 10)).toBe(
      "2026-08-11",
    );
  });

  it("sirve igual al otro lado del meridiano", () => {
    const entregado = new Date("2026-08-10T22:00:00.000Z"); // 11/08 en Madrid
    expect(dayIn(entregado, "Europe/Madrid").toISOString().slice(0, 10)).toBe(
      "2026-08-11",
    );
  });
});

describe("la primera y la última cuota", () => {
  const plan = (firstDueDate: Date, nonCollectionDays: number[] = []) =>
    buildSchedule({
      principalCents: 100_000_000,
      interestRate: 20,
      rateBasis: "TOTAL",
      interestMethod: "FLAT",
      frequency: "DAILY",
      termCount: 30,
      firstDueDate,
      nonCollectionDays,
      minorUnitStep: 100,
    });

  it("treinta cuotas diarias desde el 12 se acaban el 10 del mes siguiente", () => {
    const s = plan(new Date("2026-08-12T00:00:00.000Z"));
    expect(s.installments[0].dueDate.toISOString().slice(0, 10)).toBe(
      "2026-08-12",
    );
    expect(s.installments.at(-1)!.dueDate.toISOString().slice(0, 10)).toBe(
      "2026-09-10",
    );
  });

  it("la primera cuota del plan se corre cuando el día escogido no se cobra", () => {
    // Domingo 16, y los domingos no se cobra.
    const s = plan(new Date("2026-08-16T00:00:00.000Z"), [0]);
    expect(s.installments[0].dueDate.toISOString().slice(0, 10)).toBe(
      "2026-08-17",
    );
  });

  it("el resumen saca las dos puntas de las cuotas, no del préstamo", () => {
    const s = plan(new Date("2026-08-16T00:00:00.000Z"), [0]);
    const collect = collectionSnapshot(
      s.installments.map((i) => ({
        number: i.number,
        dueDate: i.dueDate,
        totalCents: i.totalCents,
        paidCents: 0,
        status: "PENDING" as const,
      })),
      new Date("2026-08-20T00:00:00.000Z"),
    );

    expect(collect.firstDueDate?.toISOString().slice(0, 10)).toBe("2026-08-17");
    expect(collect.lastDueDate?.toISOString().slice(0, 10)).toBe(
      s.installments.at(-1)!.dueDate.toISOString().slice(0, 10),
    );
  });

  it("las cuotas desordenadas no mueven ninguna de las dos puntas", () => {
    const s = plan(new Date("2026-08-12T00:00:00.000Z"));
    const revueltas = [...s.installments].reverse();
    const collect = collectionSnapshot(
      revueltas.map((i) => ({
        number: i.number,
        dueDate: i.dueDate,
        totalCents: i.totalCents,
        paidCents: 0,
        status: "PENDING" as const,
      })),
      new Date("2026-08-20T00:00:00.000Z"),
    );

    expect(collect.firstDueDate?.toISOString().slice(0, 10)).toBe("2026-08-12");
    expect(collect.lastDueDate?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });
});

/**
 * El atraso se mide en días, y el día es el de la empresa.
 *
 * Una cuota vence un día entero, no a una hora. Midiéndola contra el instante
 * del servidor, que puede estar en otro huso, a las siete de la noche en
 * Colombia ya era el día siguiente en UTC: entraba en el atraso una cuota que
 * todavía no había vencido, y el cobrador salía a cobrar de más.
 */
describe("cuántas cuotas están atrasadas", () => {
  // El caso real: PRE-000022, treinta cuotas diarias de 20.000, diecinueve
  // pagadas hasta el 3 de septiembre. Mirado a las 9:25 de la noche del 7.
  const cuotas = Array.from({ length: 30 }, (_, i) => ({
    number: i + 1,
    dueDate: new Date(Date.UTC(2026, 7, 16 + i)),
    totalCents: 2_000_000,
    paidCents: i < 19 ? 2_000_000 : 0,
    status: i < 19 ? "PAID" : "PENDING",
  }));

  const nocheDelSiete = new Date("2026-09-08T02:25:00.000Z");

  it("cuenta hasta la cuota de hoy, sin colar la de mañana", () => {
    const collect = collectionSnapshot(
      cuotas,
      dayIn(nocheDelSiete, "America/Bogota"),
    );

    // Vencen el 4, 5, 6 y 7. La del 8 todavía no.
    expect(collect.dueNowCount).toBe(4);
    expect(collect.overdueCents).toBe(8_000_000);
    // Y atrasadas de verdad, las que ya pasaron de fecha: el 4, 5 y 6.
    expect(collect.overdueCount).toBe(3);
    expect(collect.paidCount).toBe(19);
  });

  it("con la hora del servidor contaba una cuota de más", () => {
    // Lo que se veía en pantalla antes: 100.000 de saldo atrasado sobre cinco
    // cuotas, una de ellas la de un día que en Colombia no había llegado.
    const alRevés = collectionSnapshot(cuotas, nocheDelSiete);
    expect(alRevés.dueNowCount).toBe(5);
    expect(alRevés.overdueCents).toBe(10_000_000);
  });

  it("de día las dos horas dan lo mismo", () => {
    // Diez de la mañana del 7 en Bogotá: el mismo día en los dos husos.
    const mañana = new Date("2026-09-07T15:00:00.000Z");
    const conZona = collectionSnapshot(cuotas, dayIn(mañana, "America/Bogota"));
    const sinZona = collectionSnapshot(cuotas, mañana);

    expect(conZona.dueNowCount).toBe(4);
    expect(sinZona.dueNowCount).toBe(4);
  });

  it("la hora del día no mueve la cuenta", () => {
    const dia = dayIn(nocheDelSiete, "America/Bogota");
    const conHora = new Date(dia.getTime() + 23 * 60 * 60 * 1000);

    // Un día suelto y ese mismo día a las once de la noche cuentan igual: la
    // función normaliza, así nadie la rompe pasándole un instante por error.
    expect(collectionSnapshot(cuotas, conHora).dueNowCount).toBe(
      collectionSnapshot(cuotas, dia).dueNowCount,
    );
  });
});
