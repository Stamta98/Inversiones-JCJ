/**
 * Cargos adicionales de un préstamo.
 *
 * Lo que se cobra aparte del interés y tiene su propio nombre: papelería,
 * estudio, renovación. Un prestamista los maneja de dos maneras distintas, y
 * la diferencia no es de forma sino de plata:
 *
 * - **Descontado.** Se presta 100.000, el cargo es 5.000 y al cliente se le
 *   entregan 95.000. Debe los 120.000 de siempre; los 5.000 ya se cobraron.
 * - **Financiado.** Al cliente se le entregan los 100.000 completos y el
 *   cargo se reparte entre las cuotas: debe 120.000 + 5.000 = 125.000.
 *
 * Poner uno donde iba el otro cambia lo que sale de la caja y lo que el
 * cliente debe, así que cada cargo lleva escrito cuál de los dos es.
 */

import { addCents, roundToStep, type Cents, type MinorUnitStep } from "../money";

export type ChargeMode = "DEDUCTED" | "FINANCED";

export const CHARGE_MODES: ChargeMode[] = ["DEDUCTED", "FINANCED"];

export interface Charge {
  name: string;
  amountCents: Cents;
  mode: ChargeMode;
}

export interface ChargeSummary {
  /** Sale de lo que se entrega: el cliente recibe menos. */
  deductedCents: Cents;
  /** Se suma a lo que el cliente debe y se cobra con las cuotas. */
  financedCents: Cents;
  totalCents: Cents;
}

export class ChargeError extends Error {
  constructor(
    message: string,
    readonly code: "name" | "amount" | "overPrincipal",
  ) {
    super(message);
    this.name = "ChargeError";
  }
}

/** Deja el nombre y el monto listos para guardar, o dice por qué no sirven. */
export function normalizeCharge(
  charge: { name: string; amountCents: Cents; mode: ChargeMode },
  step: MinorUnitStep = 1,
): Charge {
  const name = charge.name.trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    throw new ChargeError("A charge needs a name", "name");
  }

  const amountCents = roundToStep(charge.amountCents, step);
  if (amountCents <= 0) {
    throw new ChargeError("A charge needs an amount", "amount");
  }

  return { name, amountCents, mode: charge.mode };
}

export function summarizeCharges(
  charges: readonly Charge[],
  step: MinorUnitStep = 1,
): ChargeSummary {
  const of = (mode: ChargeMode) =>
    roundToStep(
      addCents(
        ...charges
          .filter((charge) => charge.mode === mode)
          .map((charge) => charge.amountCents),
      ),
      step,
    );

  const deductedCents = of("DEDUCTED");
  const financedCents = of("FINANCED");

  return {
    deductedCents,
    financedCents,
    totalCents: deductedCents + financedCents,
  };
}

/**
 * Lo que el cliente recibe en la mano.
 *
 * Un cargo descontado que se comiera todo lo que se iba a entregar dejaría al
 * cliente sin plata y debiendo, que no es un préstamo: se rechaza en vez de
 * entregar cero. Una refinanciación no entrega nada, así que ahí cualquier
 * cargo descontado sobra y hay que cobrarlo en las cuotas.
 */
export function cashHandedOver(
  principalCents: Cents,
  deductedCents: Cents,
): Cents {
  if (deductedCents > 0 && deductedCents >= principalCents) {
    throw new ChargeError(
      "The charges would take the whole loan",
      "overPrincipal",
    );
  }
  return principalCents - deductedCents;
}
