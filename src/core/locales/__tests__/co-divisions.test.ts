import { describe, expect, it } from "vitest";

import {
  CO_DEFAULT_CITY,
  CO_DEFAULT_STATE,
  CO_DIVISIONS,
  citiesOf,
} from "../co-divisions";

describe("CO_DIVISIONS", () => {
  it("has the 32 departments plus Bogotá", () => {
    expect(CO_DIVISIONS).toHaveLength(33);
  });

  it("covers the whole country", () => {
    const total = CO_DIVISIONS.reduce(
      (count, division) => count + division.cities.length,
      0,
    );
    // Los municipios del país andan por los mil cien; una lista que se caiga
    // muy por debajo se quedó a medias y hay clientes que no se pueden
    // registrar donde viven.
    expect(total).toBeGreaterThan(1_050);
  });

  it("lists the thirty municipalities of Magdalena", () => {
    const magdalena = citiesOf("Magdalena");
    expect(magdalena).toHaveLength(30);
    expect(magdalena).toContain("Santa Marta");
    expect(magdalena).toContain("Ciénaga");
    expect(magdalena).toContain("Zona Bananera");
  });

  it("puts each city in its own department and nowhere else", () => {
    expect(citiesOf("Antioquia")).toContain("Medellín");
    expect(citiesOf("Antioquia")).not.toContain("Santa Marta");
    expect(citiesOf("Valle del Cauca")).toContain("Cali");
    expect(citiesOf("Bogotá D.C.")).toEqual(["Bogotá"]);
  });

  it("opens on the office's own town", () => {
    expect(citiesOf(CO_DEFAULT_STATE)).toContain(CO_DEFAULT_CITY);
  });

  it("gives nothing for a name that is not a department", () => {
    // Un nombre viejo escrito a mano —«magdalena»— no es de la lista, y sin
    // esto el desplegable de ciudades se llenaría con las del primero.
    expect(citiesOf("magdalena")).toEqual([]);
    expect(citiesOf(null)).toEqual([]);
    expect(citiesOf("")).toEqual([]);
  });

  it("writes the names the way they are read on paper", () => {
    // Sin tildes ni partículas en minúscula, el cliente no reconoce su
    // pueblo en la lista y el cobrador escoge el de al lado.
    expect(citiesOf("Antioquia")).toContain("Carmen de Viboral");
    expect(citiesOf("Antioquia")).toContain("Itagüí");
    expect(citiesOf("Magdalena")).toContain("Cerro de San Antonio");
    expect(citiesOf("Nariño")).toContain("Túquerres");
  });

  it("never repeats a city inside a department", () => {
    for (const division of CO_DIVISIONS) {
      expect(new Set(division.cities).size).toBe(division.cities.length);
    }
  });
});
