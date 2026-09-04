"use client";

import { useState } from "react";

import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import {
  postPaymentAction,
  type PaymentFormState,
} from "../../payments/actions";

const METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "CHECK",
  "MOBILE_WALLET",
  "OTHER",
] as const;

const STEP_BUTTON =
  "flex size-8 items-center justify-center rounded-md text-lg leading-none font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-30";

export function PaymentForm({
  loanId,
  suggestedAmount,
  installmentAmount,
  maxAmount,
  amountHint,
  cashBoxes,
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
  const canStep = installmentAmount > 0;
  const atCeiling = maxAmount > 0 && value >= maxAmount;

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
        <div className="sm:col-span-2">
          <Field
            label={es.payments.amount}
            htmlFor="amount"
            hint={amountHint}
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

        <Field label={es.payments.method} htmlFor="method">
          <Select id="method" name="method" defaultValue="CASH">
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {es.payments.methodLabel[method]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={es.payments.paidAt} htmlFor="paidAt">
          <Input
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        {cashBoxes.length > 0 ? (
          <Field label={es.payments.cashBox} htmlFor="cashBoxId">
            <Select
              id="cashBoxId"
              name="cashBoxId"
              defaultValue={cashBoxes[0].id}
            >
              <option value="">{es.common.none}</option>
              {cashBoxes.map((cashBox) => (
                <option key={cashBox.id} value={cashBox.id}>
                  {cashBox.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <p className="text-xs text-ink-subtle">{es.payments.allocationHint}</p>

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
            ? es.payments.collectAmount.replace(
                "{amount}",
                formatCurrency(value, currencyCode, locale, decimalPlaces),
              )
            : es.payments.new}
      </Button>
    </form>
  );
}
