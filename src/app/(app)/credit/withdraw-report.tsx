"use client";

import { useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import { withdrawReportAction, type CreditFormState } from "./actions";

/**
 * Retirar un reporte propio.
 *
 * Se pregunta por qué antes de quitarlo, y ese motivo se guarda: quitar el
 * reporte de alguien es tan serio como ponerlo, y si mañana la persona
 * pregunta, tiene que haber una respuesta escrita.
 */
export function WithdrawReport({
  reportId,
  name,
}: {
  reportId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useFormAction<CreditFormState>(
    withdrawReportAction,
    {},
  );

  if (state.success) {
    return (
      <Alert tone="positive" icon="check">
        {state.success}
      </Alert>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon="check"
        onClick={() => setOpen(true)}
      >
        {es.credit.withdrawAction}
      </Button>
    );
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="space-y-2 rounded-xl border border-border bg-surface-muted p-3"
    >
      <input type="hidden" name="reportId" value={reportId} />
      <p className="text-sm font-semibold text-ink">
        {es.credit.withdrawTitle.replace("{name}", name)}
      </p>
      <p className="text-xs text-ink-muted">{es.credit.withdrawHint}</p>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label={es.credit.withdrawReason} htmlFor="reason" required>
        <Input
          id="reason"
          name="reason"
          required
          placeholder={es.credit.withdrawReasonPlaceholder}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" icon="check" disabled={pending}>
          {pending ? es.common.saving : es.credit.withdrawSubmit}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          {es.common.cancel}
        </Button>
      </div>
    </form>
  );
}
