"use client";

import { useState } from "react";

import { Field, Input, Select } from "@/components/ui";
import {
  DEFAULT_NATIONALITY,
  NATIONALITIES,
} from "@/core/locales/nationalities";
import { es } from "@/i18n/es";

/** Lo que se escoge para escribir una que no está en la lista. */
const OTHER = "__otra__";

/**
 * La nacionalidad, escogida de una lista corta.
 *
 * Escrita a mano entraba de todas las maneras — «Colombia», «Colombiana»,
 * «colombia» — y una ficha en blanco se guardaba sin ninguna. Ahora llega con
 * Colombia puesta, que es la de casi todos, y las demás son un toque.
 *
 * «Otra» abre el campo de escribir: la lista corta es para ir rápido, no para
 * dejar por fuera al cliente que viene de otro lado.
 */
export function NationalityField({
  value,
}: {
  /** Lo que ya tiene guardado el cliente, si es que lo tiene. */
  value: string | null;
}) {
  const known = (NATIONALITIES as readonly string[]).includes(value ?? "");
  // Una ficha vieja con algo que no está en la lista se abre escribiendo, con
  // lo suyo puesto: abrirla no le puede borrar la nacionalidad.
  const [chosen, setChosen] = useState(
    value === null ? DEFAULT_NATIONALITY : known ? value : OTHER,
  );
  const [typed, setTyped] = useState(known ? "" : (value ?? ""));

  const other = chosen === OTHER;

  return (
    <>
      <Field
        label={es.customers.nationality}
        htmlFor="nationalityChoice"
        hint={other ? es.customers.nationalityHint : undefined}
      >
        <Select
          id="nationalityChoice"
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
        >
          <option value="">{es.common.none}</option>
          {NATIONALITIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={OTHER}>{es.customers.nationalityOther}</option>
        </Select>
      </Field>

      {other ? (
        <div className="mt-3">
          <Input
            id="nationality"
            name="nationality"
            value={typed}
            placeholder={es.customers.nationalityPlaceholder}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      ) : (
        // Lo que de verdad se manda. El desplegable contesta la pregunta; el
        // servidor recibe el mismo campo de siempre.
        <input type="hidden" name="nationality" value={chosen} />
      )}
    </>
  );
}
