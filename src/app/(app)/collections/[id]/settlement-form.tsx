"use client";

import { useState } from "react";

import { Alert, Button, CardBody, Field, Input, Textarea } from "@/components/ui";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import { settleRouteAction, type RouteFormState } from "../actions";

export function SettlementForm({
  routeId,
  expectedAmount,
  cashBoxes,
  currencyCode,
  locale,
  decimalPlaces,
}: {
  routeId: string;
  /** What the route's cash receipts add up to. */
  expectedAmount: number;
  cashBoxes: Array<{ id: string; label: string }>;
  currencyCode: string;
  locale: string;
  decimalPlaces: number;
}) {
  const { state, pending, onSubmit } = useFormAction<RouteFormState>(
    settleRouteAction,
    {},
  );
  const [delivered, setDelivered] = useState("");

  const money = (amount: number) =>
    formatCurrency(amount, currencyCode, locale, decimalPlaces);

  // The difference is shown while they type, so nobody has to work out in
  // their head whether the count is short.
  const typed = Number(delivered);
  const difference = delivered.length > 0 && Number.isFinite(typed)
    ? typed - expectedAmount
    : null;

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="routeId" value={routeId} />
      <CardBody className="space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.success ? (
          <Alert
            tone={state.tone ?? "positive"}
            icon={state.tone === "positive" ? "check" : "alert-triangle"}
          >
            {state.success}
          </Alert>
        ) : null}

        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <span className="text-sm text-ink-muted">
            {es.collections.expectedCash}
          </span>
          <span className="numeric text-lg font-semibold text-ink">
            {money(expectedAmount)}
          </span>
        </div>

        <Field
          label={es.collections.delivered}
          htmlFor={`delivered-${routeId}`}
          hint={es.collections.expectedCashHint}
          required
        >
          <Input
            id={`delivered-${routeId}`}
            name="deliveredAmount"
            type="number"
            step={decimalPlaces === 0 ? "1" : "0.01"}
            min="0"
            inputMode="decimal"
            value={delivered}
            onChange={(event) => setDelivered(event.target.value)}
            required
          />
        </Field>

        {difference !== null ? (
          <div
            className={[
              "flex items-baseline justify-between rounded-lg px-3 py-2",
              difference === 0
                ? "bg-positive-soft text-positive"
                : difference < 0
                  ? "bg-danger-soft text-danger"
                  : "bg-warning-soft text-warning",
            ].join(" ")}
          >
            <span className="text-sm font-medium">
              {difference === 0
                ? es.collections.balancedLabel
                : difference < 0
                  ? es.collections.shortLabel
                  : es.collections.overLabel}
            </span>
            <span className="numeric text-lg font-semibold">
              {money(Math.abs(difference))}
            </span>
          </div>
        ) : null}

        {cashBoxes.length > 0 ? (
          <Field label={es.payments.cashBox} htmlFor={`box-${routeId}`}>
            <select
              id={`box-${routeId}`}
              name="cashBoxId"
              defaultValue={cashBoxes[0]?.id ?? ""}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm text-ink focus:border-brand focus:outline-none"
            >
              {cashBoxes.map((cashBox) => (
                <option key={cashBox.id} value={cashBox.id}>
                  {cashBox.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field
          label={es.collections.settlementNotes}
          htmlFor={`settleNotes-${routeId}`}
          hint={es.collections.settlementNotesHint}
        >
          <Textarea
            id={`settleNotes-${routeId}`}
            name="notes"
            className="min-h-16"
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? es.collections.settling : es.collections.settleAction}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}
