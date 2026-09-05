"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  Button,
  CardBody,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { CREDIT_SEVERITIES, type CreditSeverity } from "@/core/credit/report";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import { reportCustomerAction, type CreditFormState } from "../actions";

/**
 * El formulario de reportar.
 *
 * Llega con lo que ya se sabe del préstamo — cuánto queda debiendo y cuántos
 * días lleva —, así que en la calle solo hay que escoger qué pasó y poner la
 * fecha en que se le avisó al cliente. Debajo de cada opción se dice cuánto
 * dura ese reporte: no es lo mismo señalar a alguien por dos años que por
 * seis, y quien lo hace tiene que saberlo antes de darle al botón.
 */
export function ReportForm({
  customerId,
  loanId,
  loanCode,
  name,
  suggestedAmount,
  daysInArrears,
  currencyCode,
  locale,
  decimalPlaces,
  amountHint,
}: {
  customerId: string;
  loanId: string | null;
  loanCode: string | null;
  name: string;
  suggestedAmount: number;
  daysInArrears: number;
  currencyCode: string;
  locale: string;
  decimalPlaces: number;
  amountHint?: string;
}) {
  const { state, pending, onSubmit } = useFormAction<CreditFormState>(
    reportCustomerAction,
    {},
  );
  const [severity, setSeverity] = useState<CreditSeverity>("DEFAULT");

  const show = (value: number) =>
    value > 0 ? value.toFixed(decimalPlaces) : "";

  // Reportado ya, no se deja el formulario abierto para hacerlo otra vez.
  if (state.success) {
    return (
      <CardBody className="space-y-3">
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/credit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            {es.credit.title}
          </Link>
          {loanId ? (
            <Link
              href={`/loans/${loanId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {loanCode ?? es.loans.singular}
            </Link>
          ) : null}
        </div>
      </CardBody>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="customerId" value={customerId} />
      {loanId ? <input type="hidden" name="loanId" value={loanId} /> : null}

      <CardBody className="space-y-3">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Field
          label={es.credit.severity}
          htmlFor="severity"
          hint={es.credit.severityHint[severity]}
          required
        >
          <Select
            id="severity"
            name="severity"
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as CreditSeverity)
            }
          >
            {CREDIT_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {es.credit.severityLabel[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={es.credit.amount}
          htmlFor="amount"
          hint={amountHint}
          required
        >
          <Input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step={decimalPlaces === 0 ? "1" : "0.01"}
            min="0"
            required
            className="numeric"
            defaultValue={show(suggestedAmount)}
          />
        </Field>

        <Field
          label={es.credit.noticedAt}
          htmlFor="noticedAt"
          hint={es.credit.noticedAtHint.replace("{days}", "20")}
          required
        >
          <Input id="noticedAt" name="noticedAt" type="date" required />
        </Field>

        <Field label={es.credit.reason} htmlFor="reason">
          <Input
            id="reason"
            name="reason"
            placeholder={es.credit.reasonPlaceholder}
          />
        </Field>

        {daysInArrears > 0 ? (
          <p className="numeric text-xs text-ink-subtle">
            {es.loans.daysInArrears}: {daysInArrears}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            type="submit"
            variant="danger"
            icon="alert-triangle"
            disabled={pending}
          >
            {pending
              ? es.common.saving
              : `${es.credit.reportSubmit} · ${formatCurrency(
                  suggestedAmount,
                  currencyCode,
                  locale,
                  decimalPlaces,
                )}`}
          </Button>
          <Link
            href={loanId ? `/loans/${loanId}` : `/customers/${customerId}`}
            className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            {es.common.cancel}
          </Link>
        </div>
        <p className="text-xs text-ink-subtle">
          {es.credit.reportHint.replace("{name}", name)}
        </p>
      </CardBody>
    </form>
  );
}
