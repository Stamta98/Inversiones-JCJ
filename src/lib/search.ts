/**
 * El texto con el que se busca en una lista.
 *
 * Sin tildes y en minúscula: quien busca a "Peña" escribe "pena", y quien
 * busca "MARÍA" escribe "maria". Se guarda ya normalizado en cada fila, y lo
 * que se teclea se pasa por aquí también, así que los dos lados se comparan
 * escritos igual.
 *
 * Vive aparte del componente de búsqueda a propósito: ese es de cliente, y lo
 * que se exporta de un módulo de cliente no se puede llamar desde el
 * servidor, que es donde se arman las filas.
 */
export function forSearch(
  ...parts: Array<string | number | null | undefined>
): string {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
