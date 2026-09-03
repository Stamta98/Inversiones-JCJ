/**
 * Códigos legibles y correlativos: CLI-000123, PRE-000045, REC-001045.
 *
 * Se sacan del código más alto que ya existe, no de cuántas filas hay. Contar
 * parece equivalente y no lo es: en cuanto se borra un préstamo o un cobro, la
 * cuenta baja y el siguiente código sale repetido, que es un código ya
 * impreso en un recibo que el cliente tiene en la mano.
 */

export type SequencePrefix = "CLI" | "PRE" | "REC";

const PAD_LENGTH = 6;

export function formatCode(prefix: SequencePrefix, value: number): string {
  return `${prefix}-${String(value).padStart(PAD_LENGTH, "0")}`;
}

/**
 * El código que sigue al más alto que hay.
 *
 * Un código con una forma que no reconocemos — escrito a mano, importado de
 * otro sistema — no puede decidir el siguiente, así que se empieza de nuevo y
 * la unicidad de la base de datos hace el resto.
 */
export function nextCode(
  prefix: SequencePrefix,
  latest: string | null | undefined,
): string {
  const match = latest?.match(/(\d+)\s*$/);
  const current = match ? Number.parseInt(match[1]!, 10) : 0;
  return formatCode(prefix, (Number.isFinite(current) ? current : 0) + 1);
}
