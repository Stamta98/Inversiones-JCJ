"use client";

import {
  Alert,
  Button,
  CardBody,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import { updatePaymentAction, type PaymentFormState } from "../actions";

const METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "CHECK",
  "MOBILE_WALLET",
  "OTHER",
] as const;

/**
 * Corrige un cobro ya registrado.
 *
 * Un monto mal tecleado no se arregla anulando y volviendo a cobrar: eso deja
 * dos recibos donde hubo un pago. Aquí el recibo sigue siendo el mismo, se
 * vuelve a aplicar sobre las cuotas y la caja se mueve solo por la diferencia.
 */
export function EditPaymentForm({
  paymentId,
  amount,
  method,
  paidAt,
  reference,
  notes,
  decimalPlaces,
}: {
  paymentId: string;
  amount: number;
  method: string;
  /** ISO date, `YYYY-MM-DD`. */
  paidAt: string;
  reference: string | null;
  notes: string | null;
  decimalPlaces: number;
}) {
  const { state, pending, onSubmit } = useFormAction<PaymentFormState>(
    updatePaymentAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <CardBody className="space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.success ? <Alert tone="positive">{state.success}</Alert> : null}
        <p className="text-xs text-ink-subtle">{es.payments.editHint}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={es.payments.amount} htmlFor="amount" required>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step={decimalPlaces === 0 ? "1" : "0.01"}
              min={decimalPlaces === 0 ? "1" : "0.01"}
              required
              defaultValue={String(amount)}
            />
          </Field>

          <Field label={es.payments.paidAt} htmlFor="paidAt">
            <Input id="paidAt" name="paidAt" type="date" defaultValue={paidAt} />
          </Field>

          <Field label={es.payments.method} htmlFor="method">
            <Select id="method" name="method" defaultValue={method}>
              {METHODS.map((option) => (
                <option key={option} value={option}>
                  {es.payments.methodLabel[option]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={es.payments.reference} htmlFor="reference">
            <Input
              id="reference"
              name="reference"
              defaultValue={reference ?? ""}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={es.common.notes} htmlFor="notes">
              <Input id="notes" name="notes" defaultValue={notes ?? ""} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? es.common.saving : es.common.save}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}
