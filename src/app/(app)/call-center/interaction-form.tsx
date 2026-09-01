"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { es } from "@/i18n/es";

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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full">
      {pending ? es.common.saving : es.callCenter.newInteraction}
    </Button>
  );
}

export function InteractionForm({
  customerId,
  loanId,
}: {
  customerId: string;
  loanId?: string;
}) {
  const [state, formAction] = useActionState<InteractionFormState, FormData>(
    logInteraction,
    {},
  );
  const [outcome, setOutcome] = useState<string>("CONTACTED");
  const showsPromise = outcome === "PAYMENT_PROMISED";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      {loanId ? <input type="hidden" name="loanId" value={loanId} /> : null}

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
      ) : null}

      <Field label={es.callCenter.channel} htmlFor={`channel-${customerId}`}>
        <Select
          id={`channel-${customerId}`}
          name="channel"
          defaultValue="CALL"
        >
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
              step="0.01"
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

      <SubmitButton />
    </form>
  );
}
