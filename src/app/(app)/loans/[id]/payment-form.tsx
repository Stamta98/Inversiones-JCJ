"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { es } from "@/i18n/es";

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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon="receipt" disabled={pending} className="w-full">
      {pending ? es.common.saving : es.payments.new}
    </Button>
  );
}

export function PaymentForm({
  loanId,
  suggestedAmount,
  cashBoxes,
}: {
  loanId: string;
  suggestedAmount: number;
  cashBoxes: Array<{ id: string; label: string }>;
}) {
  const [state, formAction] = useActionState<PaymentFormState, FormData>(
    postPaymentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="loanId" value={loanId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
      ) : null}

      <Field label={es.payments.amount} htmlFor="amount" required>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          defaultValue={suggestedAmount > 0 ? suggestedAmount.toFixed(2) : ""}
        />
      </Field>

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
          <Select id="cashBoxId" name="cashBoxId" defaultValue={cashBoxes[0].id}>
            <option value="">{es.common.none}</option>
            {cashBoxes.map((cashBox) => (
              <option key={cashBox.id} value={cashBox.id}>
                {cashBox.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label={es.payments.reference} htmlFor="reference">
        <Input id="reference" name="reference" />
      </Field>

      <p className="text-xs text-ink-subtle">{es.payments.allocationHint}</p>

      <SubmitButton />
    </form>
  );
}
