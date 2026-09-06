"use client";

import { useState } from "react";

import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { COLLECT_METHODS } from "@/core/types";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import {
  postPaymentAction,
  type PaymentFormState,
} from "../../payments/actions";

/** Lo que se cobra cuando no es la cuota. */
const CONCEPTS = ["LATE_FEE", "CHARGE"] as const;

const STEP_BUTTON =
  "flex size-8 items-center justify-center rounded-md text-lg leading-none font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-30";

export function PaymentForm({
  loanId,
  suggestedAmount,
  installmentAmount,
  maxAmount,
  amountHint,
  cashBoxes,
  pendingCharges,
  currencyCode,
  locale,
  decimalPlaces,
}: {
  loanId: string;
  suggestedAmount: number;
  /** La cuota, que es lo que suma o resta cada toque del contador. */
  installmentAmount: number;
  /** Lo que falta para saldar: cobrar más que eso no tiene sentido. */
  maxAmount: number;
  /** De dónde salió el valor propuesto, dicho debajo del campo. */
  amountHint?: string;
  cashBoxes: Array<{ id: string; label: string }>;
  /**
   * Los cargos que este préstamo dejó anotados y todavía se le deben, con lo
   * que le falta a cada uno. Sin ninguno no hay nada que cobrar aparte.
   */
  pendingCharges: Array<{ id: string; name: string; left: number }>;
  currencyCode: string;
  locale: string;
  /** Zero where the currency has no cents, so the field never suggests any. */
  decimalPlaces: number;
}) {
  const wholeUnits = decimalPlaces === 0;
  const { state, pending, onSubmit } = useFormAction<PaymentFormState>(
    postPaymentAction,
    {},
  );

  const show = (value: number) =>
    value > 0 ? value.toFixed(decimalPlaces) : "";

  // Qué se está cobrando. Un cargo adicional es plata que entra pero no baja
  // lo que el cliente debe, así que el formulario cambia de forma: no hay
  // contador de cuotas ni tope, y en cambio hay que decir de qué es el cargo.
  const [concept, setConcept] = useState<"INSTALLMENT" | "LATE_FEE" | "CHARGE">(
    "INSTALLMENT",
  );
  const cobrandoCargo = concept === "CHARGE";
  // La forma de pago se guarda aparte del desplegable: mientras se cobra un
  // cargo la lista enseña "Cargo adicional", y al volver a una cuota tiene
  // que reaparecer la que estaba escogida, no la de por defecto.
  const [metodo, setMetodo] = useState("CASH");
  // El día de hoy como lo ve el teléfono. `en-CA` lo escribe «2026-09-06»,
  // que es lo que el servidor espera.
  const hoy = new Date().toLocaleDateString("en-CA");
  // Cuál de los cargos del préstamo se está cobrando. El primero viene
  // puesto: con uno solo pendiente, que es lo normal, no hay nada que escoger.
  const [chargeId, setChargeId] = useState(pendingCharges[0]?.id ?? "");
  const charge = pendingCharges.find((row) => row.id === chargeId);
  const sinCargos = pendingCharges.length === 0;

  const [amount, setAmount] = useState(() => show(suggestedAmount));
  // Cuántas cuotas cubre lo que hay en el campo. Null cuando el cobrador
  // escribió un monto suyo: decir "1" ahí sería mentirle.
  const [count, setCount] = useState<number | null>(
    suggestedAmount > 0 && suggestedAmount === installmentAmount ? 1 : null,
  );

  // Después de cobrar, el servidor manda la cuota siguiente: el campo se pone
  // en ella solo, en vez de quedarse con el número que ya se cobró.
  const [proposed, setProposed] = useState(suggestedAmount);
  if (proposed !== suggestedAmount) {
    setProposed(suggestedAmount);
    setAmount(show(suggestedAmount));
    setCount(
      suggestedAmount > 0 && suggestedAmount === installmentAmount ? 1 : null,
    );
  }

  const value = Number(amount) || 0;
  // El contador de cuotas y el tope son de la cuota: un cargo no tiene ni lo
  // uno ni lo otro, se cobra lo que se acordó.
  const canStep = installmentAmount > 0 && !cobrandoCargo;
  // Cobrando un cargo el tope es lo que a ese cargo le falta: cobrar de más
  // dejaría el préstamo diciendo que el cliente pagó por algo que no debía.
  const ceiling = cobrandoCargo ? (charge?.left ?? 0) : maxAmount;
  const atCeiling = ceiling > 0 && value >= ceiling;

  const setInstallments = (next: number) => {
    const whole = Math.max(1, next);
    const total =
      maxAmount > 0
        ? Math.min(whole * installmentAmount, maxAmount)
        : whole * installmentAmount;
    setCount(whole);
    setAmount(show(total));
  };

  // Desde un monto escrito a mano, el contador no sube desde cero: sube a la
  // cuota entera que sigue y baja a la que ya está cubierta.
  const step = (by: number) =>
    setInstallments(
      count !== null
        ? count + by
        : Math.max(
            1,
            by > 0
              ? Math.ceil(value / installmentAmount)
              : Math.floor(value / installmentAmount),
          ),
    );

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="loanId" value={loanId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Una sola lista para las dos preguntas. Puede parecer que mezcla
            —cómo paga y qué paga—, pero un cargo cobrado aparte no guarda
            forma de pago en ninguna parte: lo que dice dónde cayó la plata es
            la caja que se escoge abajo. Así que donde iría el método de un
            cargo no hay nada que perder, y el cobrador encuentra el cargo
            donde lo busca en vez de en un desplegable aparte. */}
        <div className="sm:col-span-2">
          <Field
            label={es.payments.method}
            htmlFor="method"
            hint={es.payments.conceptHint[concept]}
          >
            <Select
              id="method"
              value={concept === "INSTALLMENT" ? metodo : concept}
              onChange={(event) => {
                const value = event.target.value;
                const otraCosa = (CONCEPTS as readonly string[]).includes(
                  value,
                );
                if (!otraCosa) setMetodo(value);
                setConcept(
                  otraCosa ? (value as "LATE_FEE" | "CHARGE") : "INSTALLMENT",
                );
                // Al pasar a mora o a cargo el campo queda en blanco: la
                // cuota que proponía no tiene nada que ver con lo que vale
                // ninguna de las dos.
                setCount(null);
                // El cargo llega con lo que le falta puesto: es lo que se
                // cobra casi siempre, y se puede bajar para abonarle.
                setAmount(
                  value === "CHARGE"
                    ? show(pendingCharges[0]?.left ?? 0)
                    : otraCosa
                      ? ""
                      : show(suggestedAmount),
                );
                if (value === "CHARGE")
                  setChargeId(pendingCharges[0]?.id ?? "");
              }}
            >
              {/* Los cuatro seguidos, sin rótulos de grupo. Separarlos en
                  "cómo te paga" y "o cóbrale otra cosa" sonaba bien escrito
                  pero en el teléfono son dos renglones de texto en medio de
                  una lista de cuatro cosas: estorban más de lo que explican,
                  y lo que hace cada opción ya lo dice la línea de abajo del
                  desplegable. */}
              {COLLECT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {es.payments.methodLabel[method]}
                </option>
              ))}
              {CONCEPTS.map((value) => (
                <option
                  key={value}
                  value={value}
                  // Sin cargos anotados no hay nada que cobrar aparte: la
                  // opción se ve pero no se escoge, y debajo dice por qué.
                  disabled={value === "CHARGE" && sinCargos}
                >
                  {es.payments.conceptLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Lo que de verdad se manda: la lista de arriba contesta las dos
            cosas, pero el servidor las recibe separadas como siempre. */}
        <input type="hidden" name="concept" value={concept} />
        <input
          type="hidden"
          name="method"
          value={cobrandoCargo ? "CASH" : metodo}
        />

        {cobrandoCargo ? (
          <div className="sm:col-span-2">
            {sinCargos ? (
              <Alert tone="info">{es.payments.chargeNone}</Alert>
            ) : (
              <Field
                label={es.payments.chargePick}
                htmlFor="chargeId"
                hint={es.payments.chargePickHint}
                required
              >
                <Select
                  id="chargeId"
                  name="chargeId"
                  value={chargeId}
                  required
                  onChange={(event) => {
                    const next = pendingCharges.find(
                      (row) => row.id === event.target.value,
                    );
                    setChargeId(event.target.value);
                    setAmount(show(next?.left ?? 0));
                  }}
                >
                  {pendingCharges.map((row) => (
                    <option key={row.id} value={row.id}>
                      {es.payments.chargeOption
                        .replace("{name}", row.name)
                        .replace(
                          "{amount}",
                          formatCurrency(
                            row.left,
                            currencyCode,
                            locale,
                            decimalPlaces,
                          ),
                        )}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Field
            label={es.payments.amount}
            htmlFor="amount"
            // De dónde salió el monto propuesto solo tiene sentido
            // cobrando la cuota: ni la mora ni el cargo valen eso.
            hint={concept === "INSTALLMENT" ? amountHint : undefined}
            required
          >
            <div className="flex items-stretch gap-2">
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step={wholeUnits ? "1" : "0.01"}
                min={wholeUnits ? "1" : "0.01"}
                required
                className="numeric flex-1 py-2.5 text-lg font-semibold"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setCount(null);
                }}
              />

              {/* El cliente que paga dos cuotas es cosa de todos los días: se
                tocan, no se teclean. */}
              {canStep ? (
                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-muted px-1">
                  <button
                    type="button"
                    className={STEP_BUTTON}
                    aria-label={es.payments.oneLess}
                    disabled={
                      count !== null ? count <= 1 : value <= installmentAmount
                    }
                    onClick={() => step(-1)}
                  >
                    −
                  </button>
                  <span className="w-11 text-center leading-tight">
                    <span className="numeric block text-sm font-semibold text-ink">
                      {count ?? "—"}
                    </span>
                    <span className="block text-[0.5625rem] text-ink-subtle">
                      {count === null
                        ? es.payments.customAmount
                        : count === 1
                          ? es.payments.installmentCountOne
                          : es.payments.installmentCount}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={STEP_BUTTON}
                    aria-label={es.payments.oneMore}
                    disabled={atCeiling}
                    onClick={() => step(1)}
                  >
                    +
                  </button>
                </div>
              ) : null}
            </div>
          </Field>
        </div>

        {/* El día y la caja ya no se preguntan: se cobra hoy y entra a la
            caja de siempre, que es lo que pasa el noventa y nueve por ciento
            de las veces. Van escondidos y no borrados — sin caja, un cargo no
            se puede cobrar y un abono no entraría a ninguna parte, y el día
            es el que decide en qué resumen cae la plata.

            El día se toma de la hora del teléfono y no en UTC: cobrando de
            noche, `toISOString` daba el día siguiente y el abono se iba al
            resumen de mañana. */}
        <input type="hidden" name="paidAt" value={hoy} />
        <input type="hidden" name="cashBoxId" value={cashBoxes[0]?.id ?? ""} />
      </div>

      {cobrandoCargo ? null : (
        <p className="text-xs text-ink-subtle">{es.payments.allocationHint}</p>
      )}

      {/* El botón dice lo que se va a cobrar: en la puerta uno confirma
          mirando el botón, no devolviéndose al campo. */}
      <Button
        type="submit"
        icon="receipt"
        disabled={pending}
        className="w-full sm:w-auto"
      >
        {pending
          ? es.common.saving
          : value > 0
            ? (cobrandoCargo
                ? es.payments.collectCharge
                : es.payments.collectAmount
              ).replace(
                "{amount}",
                formatCurrency(value, currencyCode, locale, decimalPlaces),
              )
            : es.payments.new}
      </Button>
    </form>
  );
}
