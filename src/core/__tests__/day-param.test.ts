import { describe, expect, it } from "vitest";

import { dayIn, dayParam, dayWindowIn, parseDay, todayIn } from "../dates";

describe("parseDay", () => {
  it("lee el día que viene en la dirección", () => {
    expect(parseDay("2026-08-05")).toEqual(new Date(Date.UTC(2026, 7, 5)));
  });

  it("no acepta lo que no es una fecha", () => {
    for (const value of [
      "",
      "hoy",
      "2026-8-5",
      "05/08/2026",
      undefined,
      null,
    ]) {
      expect(parseDay(value)).toBeNull();
    }
  });

  // Un 31 de febrero rodaría solo hasta marzo y el resumen mostraría un día
  // que nadie pidió.
  it("no acepta días que no existen", () => {
    expect(parseDay("2026-02-31")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("2026-00-10")).toBeNull();
  });

  it("va y vuelve igual", () => {
    expect(dayParam(parseDay("2026-08-05")!)).toBe("2026-08-05");
  });
});

describe("todayIn", () => {
  it("keeps the company's day when the server has already rolled over", () => {
    // Las 19:30 del 7 de septiembre en Bogotá son las 00:30 del 8 en UTC.
    // El servidor de Vercel vive en UTC: con su día, un cobro de esa hora
    // caía en el resumen de mañana y el de hoy quedaba diciendo de menos.
    const seteYMedia = new Date("2026-09-08T00:30:00.000Z");
    expect(dayIn(seteYMedia, "America/Bogota").toISOString()).toBe(
      "2026-09-07T00:00:00.000Z",
    );
    expect(dayIn(seteYMedia, "UTC").toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
  });

  it("reads today in the company's zone", () => {
    const hoy = todayIn("America/Bogota");
    expect(hoy.toISOString()).toBe(
      `${dayIn(new Date(), "America/Bogota").toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    // Siempre a medianoche, que es el ancla con la que se guardan los días.
    expect(hoy.getUTCHours()).toBe(0);
  });
});

describe("dayWindowIn", () => {
  const dia = new Date("2026-09-07T00:00:00.000Z");

  it("mide el día desde la medianoche de la empresa, no la de UTC", () => {
    const { gte, lt } = dayWindowIn(dia, "America/Bogota");
    // Colombia va cinco horas atrás: su 7 de septiembre empieza a las 05:00Z.
    expect(gte.toISOString()).toBe("2026-09-07T05:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-09-08T05:00:00.000Z");
  });

  it("deja el préstamo de las 19:27 en el día en que se entregó", () => {
    // 00:27Z del 8 son las 19:27 del 7 en Colombia.
    const entregado = new Date("2026-09-08T00:27:00.000Z");
    const siete = dayWindowIn(dia, "America/Bogota");
    const ocho = dayWindowIn(
      new Date("2026-09-08T00:00:00.000Z"),
      "America/Bogota",
    );
    expect(entregado >= siete.gte && entregado < siete.lt).toBe(true);
    expect(entregado >= ocho.gte && entregado < ocho.lt).toBe(false);
  });

  it("mete también el mediodía UTC, que es como se guardan los cobros", () => {
    const cobro = new Date("2026-09-07T12:00:00.000Z");
    const { gte, lt } = dayWindowIn(dia, "America/Bogota");
    expect(cobro >= gte && cobro < lt).toBe(true);
  });

  it("sigue el cambio de hora donde lo hay", () => {
    // Chile adelanta la hora el primer domingo de septiembre de 2026.
    const antes = dayWindowIn(
      new Date("2026-09-01T00:00:00.000Z"),
      "America/Santiago",
    );
    const despues = dayWindowIn(
      new Date("2026-09-10T00:00:00.000Z"),
      "America/Santiago",
    );
    expect(
      antes.gte.getTime() - new Date("2026-09-01T00:00:00.000Z").getTime(),
    ).not.toBe(
      despues.gte.getTime() - new Date("2026-09-10T00:00:00.000Z").getTime(),
    );
    // Y el día sigue durando lo que dure: 23, 24 o 25 horas, nunca otra cosa.
    for (const v of [antes, despues]) {
      const horas = (v.lt.getTime() - v.gte.getTime()) / 3_600_000;
      expect([23, 24, 25]).toContain(horas);
    }
  });

  it("con la empresa en UTC no cambia nada", () => {
    const { gte, lt } = dayWindowIn(dia, "UTC");
    expect(gte.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(lt.toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });
});
