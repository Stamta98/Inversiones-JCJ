/**
 * Escribir y leer un monto con separador de miles mientras se teclea.
 *
 * Vive fuera del componente a propósito: `money-input.tsx` es `"use client"`,
 * y lo que se exporta de un módulo de cliente no se puede llamar desde el
 * servidor. Aquí es código común, y además se puede probar solo.
 *
 * El valor que se guarda en el estado y se manda al servidor es siempre el
 * número pelado —«30000»—; lo agrupado es nada más lo que se ve.
 */

/** La coma del español, el punto del inglés: se la pregunta al locale. */
export function decimalMark(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === "decimal")?.value ?? ",";
}

/**
 * De lo que se tecleó al número pelado.
 *
 * Se parte por la marca decimal y a cada lado le quedan solo los dígitos, así
 * que los puntos de miles que el propio campo acaba de pintar se caen solos:
 * «30.000» vuelve a ser «30000».
 */
export function readAmount(
  text: string,
  decimalPlaces: number,
  locale: string,
): string {
  const digits = (part: string) => part.replace(/\D/g, "");
  // Sin decimales no hay nada que separar: en pesos colombianos el punto que
  // se teclea es de miles, no de centavos.
  if (decimalPlaces <= 0) return strip(digits(text));

  const mark = decimalMark(locale);
  let at = text.lastIndexOf(mark);
  // El teclado de algunos teléfonos solo da punto, aunque el idioma pida
  // coma. Se toma por decimal cuando no puede ser de miles: el separador de
  // miles siempre lleva tres dígitos detrás.
  if (at < 0 && mark !== ".") {
    const dot = text.lastIndexOf(".");
    if (dot >= 0 && digits(text.slice(dot + 1)).length !== 3) at = dot;
  }
  if (at < 0) return strip(digits(text));

  const whole = strip(digits(text.slice(0, at)));
  const fraction = digits(text.slice(at + 1)).slice(0, decimalPlaces);
  return `${whole}.${fraction}`;
}

/** Los ceros de más a la izquierda estorban: «030000» se guarda «30000». */
function strip(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}

/**
 * Del número pelado a lo que se ve en el campo.
 *
 * Los decimales no se rellenan mientras se escribe: quien va tecleando
 * «1250,» tiene que poder seguir, y un `toFixed` le borraría la coma.
 */
export function showAmount(
  raw: string,
  decimalPlaces: number,
  locale: string,
): string {
  if (raw === "") return "";
  const [whole = "", fraction] = raw.split(".");
  const grouped =
    whole === ""
      ? ""
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
          Number(whole),
        );
  if (fraction === undefined || decimalPlaces === 0) return grouped;
  return `${grouped}${decimalMark(locale)}${fraction.slice(0, decimalPlaces)}`;
}
