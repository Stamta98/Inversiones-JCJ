"use client";

import { useState } from "react";

import { Field, Input, Select } from "@/components/ui";
import {
  CO_DEFAULT_CITY,
  CO_DEFAULT_STATE,
  CO_DIVISIONS,
  citiesOf,
} from "@/core/locales/co-divisions";
import { es } from "@/i18n/es";

/**
 * Dónde vive el cliente: el departamento y la ciudad.
 *
 * En Colombia se escogen de una lista, y la de ciudades es la del
 * departamento que esté puesto: escribiéndolos, el mismo pueblo entraba como
 * «Santa marta», «Sta Marta» y «santa marta», y buscar por ciudad no
 * encontraba a la mitad de los clientes.
 *
 * En los demás países siguen siendo dos campos de escribir. Una lista de
 * departamentos colombianos en una oficina dominicana no es una ayuda: es un
 * estorbo con nombres que nadie reconoce.
 */
export function HomePlace({
  countryCode,
  stateLabel,
  city,
  state,
}: {
  /** El país de la empresa, en ISO de dos letras. */
  countryCode: string | null;
  /** Cómo se llama aquí la división de arriba: departamento, provincia… */
  stateLabel: string;
  /** Lo que ya tiene guardado el cliente, si es que lo tiene. */
  city: string | null;
  state: string | null;
}) {
  const colombia = countryCode === "CO";

  // Un cliente nuevo llega con la oficina puesta; uno viejo, con lo suyo. Sin
  // esto había que bajar a escoger lo mismo en cada ficha, y la que se
  // guardaba de afán quedaba sin ciudad.
  const [chosenState, setChosenState] = useState(
    state ?? (colombia ? CO_DEFAULT_STATE : ""),
  );
  const [chosenCity, setChosenCity] = useState(
    city ?? (colombia && !state ? CO_DEFAULT_CITY : ""),
  );

  if (!colombia) {
    return (
      <>
        <Field label={es.customers.city} htmlFor="city">
          <Input id="city" name="city" defaultValue={city ?? ""} />
        </Field>
        <Field label={stateLabel} htmlFor="state">
          <Input id="state" name="state" defaultValue={state ?? ""} />
        </Field>
      </>
    );
  }

  const cities = citiesOf(chosenState);
  // Lo que ya estaba guardado se conserva aunque no esté en la lista: una
  // ficha vieja con «Santa marta» escrito a mano no puede perder la ciudad
  // por abrirla. Se ofrece igual, y al escoger otra queda la de la lista.
  const withStored = (options: readonly string[], value: string) =>
    value && !options.includes(value) ? [value, ...options] : options;

  return (
    <>
      {/* El departamento primero: la lista de ciudades sale de él. */}
      <Field label={stateLabel} htmlFor="state">
        <Select
          id="state"
          name="state"
          value={chosenState}
          onChange={(event) => {
            setChosenState(event.target.value);
            // Cambiar de departamento deja la ciudad en blanco a menos que la
            // que estaba también sea de allá: Santa Marta no puede quedarse
            // en Antioquia porque nadie volvió a tocar el desplegable.
            const next = citiesOf(event.target.value);
            setChosenCity(next.includes(chosenCity) ? chosenCity : "");
          }}
        >
          <option value="">{es.common.none}</option>
          {withStored(
            CO_DIVISIONS.map((division) => division.name),
            chosenState,
          ).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={es.customers.city}
        htmlFor="city"
        hint={chosenState ? undefined : es.customers.cityNeedsState}
      >
        <Select
          id="city"
          name="city"
          value={chosenCity}
          disabled={!chosenState}
          onChange={(event) => setChosenCity(event.target.value)}
        >
          <option value="">{es.common.none}</option>
          {withStored(cities, chosenCity).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
