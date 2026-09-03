"use client";

import { useState } from "react";

import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import { logInteraction, type InteractionFormState } from "./actions";

const CHANNELS = ["CALL", "WHATSAPP", "SMS", "EMAIL", "VISIT", "NOTE"] as const;
const OUTCOMES = [
  "CONTACTED",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "PAYMENT_PROMISED",
  "PAYMENT_MADE",
  "REFUSED",
  "DISPUTE",
  "CALLBACK_REQUESTED",
] as const;

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full">
      {pending ? es.common.saving : es.callCenter.newInteraction}
    </Button>
  );
}

export function InteractionForm({
  customerId,
  loanId,
  decimalPlaces,
}: {
  customerId: string;
  loanId?: string;
  /** Zero where the currency has no cents, so no field offers any. */
  decimalPlaces: number;
}) {
  const { state, pending, onSubmit } = useFormAction<InteractionFormState>(
    logInteraction,
    {},
  );
  const [outcome, setOutcome] = useState<string>("CONTACTED");
  const showsPromise = outcome === "PAYMENT_PROMISED";

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      {loanId ? <input type="hidden" name="loanId" value={loanId} /> : null}

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
      ) : null}

      <Field label={es.callCenter.channel} htmlFor={`channel-${customerId}`}>
        <Select id={`channel-${customerId}`} name="channel" defaultValue="CALL">
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {es.callCenter.channelLabel[channel]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={es.callCenter.outcome} htmlFor={`outcome-${customerId}`}>
        <Select
          id={`outcome-${customerId}`}
          name="outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
        >
          {OUTCOMES.map((option) => (
            <option key={option} value={option}>
              {es.callCenter.outcomeLabel[option]}
            </option>
          ))}
        </Select>
      </Field>

      {showsPromise ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={es.callCenter.promisedAmount}
            htmlFor={`promisedAmount-${customerId}`}
          >
            <Input
              id={`promisedAmount-${customerId}`}
              name="promisedAmount"
              type="number"
              inputMode="decimal"
              step={decimalPlaces === 0 ? "1" : "0.01"}
              min="0"
            />
          </Field>
          <Field
            label={es.callCenter.promisedFor}
            htmlFor={`promisedFor-${customerId}`}
          >
            <Input
              id={`promisedFor-${customerId}`}
              name="promisedFor"
              type="date"
            />
          </Field>
        </div>
      ) : null}

      <Field label={es.common.notes} htmlFor={`notes-${customerId}`}>
        <Textarea id={`notes-${customerId}`} name="notes" rows={2} />
      </Field>

      <SubmitButton pending={pending} />
    </form>
  );
}
