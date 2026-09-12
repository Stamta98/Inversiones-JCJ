"use client";

import type { InputHTMLAttributes } from "react";

import { readAmount, showAmount } from "@/lib/money-format";

import { Input } from "./index";

/**
 * Un campo de monto que se lee de un vistazo: «30.000», no «30000».
 *
 * Por dentro es un `text` y no un `number`. Un `number` no deja pintar los
 * puntos —el navegador lo da por inválido y devuelve el valor en blanco—, y
 * además saca las flechitas de subir y bajar, que en el teléfono no sirven
 * para nada y se tocan sin querer. El teclado numérico se pide con
 * `inputMode`.
 *
 * Lo que viaja al servidor es el número pelado, en un `hidden` con el nombre
 * del campo, así que la acción del formulario no se entera de nada.
 */
export function MoneyInput({
  name,
  value,
  onValueChange,
  decimalPlaces,
  locale,
  className,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  /** El nombre con el que el servidor espera el monto. */
  name: string;
  /** El número pelado: «30000». */
  value: string;
  onValueChange: (raw: string) => void;
  decimalPlaces: number;
  locale: string;
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Input
        {...props}
        type="text"
        inputMode={decimalPlaces === 0 ? "numeric" : "decimal"}
        autoComplete="off"
        className={className}
        value={showAmount(value, decimalPlaces, locale)}
        onChange={(event) =>
          onValueChange(readAmount(event.target.value, decimalPlaces, locale))
        }
      />
    </>
  );
}
