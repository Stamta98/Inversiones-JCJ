/**
 * Quién puede salir de fiador.
 *
 * La llave foránea de la base solo dice que el id existe en `Customer`:
 * acepta el cliente de otra oficina y acepta al mismo que está pidiendo la
 * plata. Ninguna de las dos cosas la ofrece el desplegable, pero el
 * desplegable no es la puerta —  un envío a mano llega igual al servidor —,
 * así que la regla vive aquí y el servicio la aplica antes de escribir.
 */

/** Por qué no sirve ese fiador, o null si sirve. */
export type GuarantorProblem = "guarantorIsBorrower" | "guarantorNotFound";

/**
 * Decide si el fiador escogido puede guardarse.
 *
 * `found` es si ese cliente existe **en esta empresa**: la consulta la hace
 * quien llama, porque aquí no se toca la base.
 *
 * Sin fiador no hay problema: no es obligatorio, hay préstamos que se dan
 * sin nadie detrás.
 */
export function guarantorProblem(
  guarantorId: string | null | undefined,
  customerId: string,
  found: boolean,
): GuarantorProblem | null {
  if (!guarantorId) return null;
  // Se mira primero quién es: a quien se puso a sí mismo hay que decirle eso
  // y no un "no está registrado" que no le explica nada.
  if (guarantorId === customerId) return "guarantorIsBorrower";
  if (!found) return "guarantorNotFound";
  return null;
}
