"use client";

import { useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Field,
  Icon,
  Input,
  Select,
  Textarea,
  type Tone,
} from "@/components/ui";
import {
  STOP_STATUSES,
  needsPromiseDate,
  type StopStatus,
} from "@/core/collections/route";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import {
  collectAtStopAction,
  moveStopDownAction,
  moveStopUpAction,
  recordVisitAction,
  removeStopAction,
  type RouteFormState,
} from "../actions";

export const STOP_TONES: Record<StopStatus, Tone> = {
  PENDING: "neutral",
  VISITED: "info",
  COLLECTED: "positive",
  NOT_FOUND: "warning",
  PROMISED: "info",
  REFUSED: "danger",
};

export interface StopView {
  id: string;
  position: number;
  customerName: string;
  customerCode: string;
  loanId: string | null;
  loanCode: string | null;
  phone: string | null;
  address: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  status: StopStatus;
  expectedAmount: number;
  collectedAmount: number;
  promisedFor: string | null;
  notes: string | null;
  receiptNumber: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Digits only: a phone written "809-555-0100" is not a valid wa.me link. */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "");
}

function Feedback({ state }: { state: RouteFormState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.success)
    return (
      <Alert tone="positive" icon="check">
        {state.success}
      </Alert>
    );
  return null;
}

export function StopCard({
  stop,
  cashBoxes,
  currencyCode,
  locale,
  decimalPlaces,
  canCollect,
  canEdit,
  editable,
}: {
  stop: StopView;
  cashBoxes: Array<{ id: string; label: string }>;
  /** The company's money settings, so amounts read the same as everywhere. */
  currencyCode: string;
  locale: string;
  decimalPlaces: number;
  canCollect: boolean;
  canEdit: boolean;
  /** False on a closed route: it is history, not a worklist. */
  editable: boolean;
}) {
  const money = (amount: number) =>
    formatCurrency(amount, currencyCode, locale, decimalPlaces);
  const [open, setOpen] = useState<"none" | "collect" | "visit">("none");
  const collect = useFormAction<RouteFormState>(collectAtStopAction, {});
  const visit = useFormAction<RouteFormState>(recordVisitAction, {});
  const [status, setStatus] = useState<StopStatus>(stop.status);

  const pending = Math.max(0, stop.expectedAmount - stop.collectedAmount);
  const maps =
    stop.latitude !== null && stop.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`
      : null;

  return (
    <div className="border-b border-border p-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="numeric mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted">
          {stop.position}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{stop.customerName}</span>
            {stop.loanCode ? (
              <span className="text-xs text-ink-subtle">{stop.loanCode}</span>
            ) : null}
            <Badge tone={STOP_TONES[stop.status]}>
              {es.collections.stopStatus[stop.status]}
            </Badge>
          </div>

          {stop.address || stop.landmark ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
              {[stop.address, stop.landmark].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
            {maps ? (
              <a
                href={maps}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-brand-strong hover:underline"
              >
                <Icon name="map-pin" size={12} />
                {es.customers.openInMaps}
              </a>
            ) : null}
            {stop.phone ? (
              <>
                <a
                  href={`tel:${stop.phone}`}
                  className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                >
                  <Icon name="phone" size={12} />
                  {es.collections.call}
                </a>
                <a
                  href={`https://wa.me/${digitsOf(stop.phone)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                >
                  <Icon name="message-circle" size={12} />
                  {es.collections.whatsapp}
                </a>
              </>
            ) : null}
          </div>

          {stop.promisedFor ? (
            <p className="mt-1 text-xs text-info">
              {es.collections.promisedFor}: {stop.promisedFor}
            </p>
          ) : null}
          {stop.notes ? (
            <p className="mt-1 text-xs text-ink-subtle">{stop.notes}</p>
          ) : null}
          {stop.receiptNumber ? (
            <p className="mt-1 text-xs text-positive">
              {es.payments.receipt} {stop.receiptNumber}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="numeric text-sm font-semibold text-ink">
            {money(pending)}
          </p>
          {stop.collectedAmount > 0 ? (
            <p className="numeric text-xs text-positive">
              {es.collections.collectedAmount}: {money(stop.collectedAmount)}
            </p>
          ) : null}
        </div>
      </div>

      {editable ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-10">
          {canCollect && stop.loanId ? (
            <Button
              type="button"
              size="sm"
              icon="hand-coins"
              onClick={() => setOpen(open === "collect" ? "none" : "collect")}
            >
              {es.collections.collect}
            </Button>
          ) : null}

          {canEdit ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon="file-text"
                onClick={() => setOpen(open === "visit" ? "none" : "visit")}
              >
                {es.collections.visitResult}
              </Button>

              <form action={moveStopUpAction}>
                <input type="hidden" name="stopId" value={stop.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  icon="arrow-up"
                  aria-label={es.collections.moveUp}
                  disabled={!stop.canMoveUp}
                />
              </form>
              <form action={moveStopDownAction}>
                <input type="hidden" name="stopId" value={stop.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  icon="arrow-down"
                  aria-label={es.collections.moveDown}
                  disabled={!stop.canMoveDown}
                />
              </form>
              <form action={removeStopAction}>
                <input type="hidden" name="stopId" value={stop.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  aria-label={es.collections.removeStop}
                />
              </form>
            </>
          ) : null}
        </div>
      ) : null}

      {editable && open === "collect" ? (
        <form
          onSubmit={collect.onSubmit}
          className="mt-3 space-y-3 rounded-lg bg-surface-muted p-3"
        >
          <input type="hidden" name="stopId" value={stop.id} />
          <Feedback state={collect.state} />

          {/* Once the receipt exists the fields go away: leaving them filled in
              is how the same amount gets charged twice. */}
          {collect.state.success ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={es.payments.amount}
                htmlFor={`amount-${stop.id}`}
                hint={es.collections.collectHint}
                required
              >
                <Input
                  id={`amount-${stop.id}`}
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={pending > 0 ? pending : ""}
                  inputMode="decimal"
                  required
                />
              </Field>

              <Field label={es.payments.method} htmlFor={`method-${stop.id}`}>
                <Select
                  id={`method-${stop.id}`}
                  name="method"
                  defaultValue="CASH"
                >
                  {Object.entries(es.payments.methodLabel).map(
                    ([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </Field>

              {cashBoxes.length > 0 ? (
                <Field
                  label={es.payments.cashBox}
                  htmlFor={`cashBox-${stop.id}`}
                >
                  <Select
                    id={`cashBox-${stop.id}`}
                    name="cashBoxId"
                    defaultValue={cashBoxes[0]?.id ?? ""}
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

              <Field
                label={es.common.notes}
                htmlFor={`collectNotes-${stop.id}`}
              >
                <Input id={`collectNotes-${stop.id}`} name="notes" />
              </Field>
            </div>
          )}

          <div className="flex justify-end">
            {collect.state.success ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOpen("none")}
              >
                {es.common.close}
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={collect.pending}>
                {collect.pending
                  ? es.collections.collecting
                  : es.collections.collect}
              </Button>
            )}
          </div>
        </form>
      ) : null}

      {editable && open === "visit" ? (
        <form
          onSubmit={visit.onSubmit}
          className="mt-3 space-y-3 rounded-lg bg-surface-muted p-3"
        >
          <input type="hidden" name="stopId" value={stop.id} />
          <Feedback state={visit.state} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={es.common.status}
              htmlFor={`status-${stop.id}`}
              required
            >
              <Select
                id={`status-${stop.id}`}
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StopStatus)
                }
              >
                {STOP_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {es.collections.stopStatus[option]}
                  </option>
                ))}
              </Select>
            </Field>

            {needsPromiseDate(status) ? (
              <Field
                label={es.collections.promisedFor}
                htmlFor={`promisedFor-${stop.id}`}
              >
                <Input
                  id={`promisedFor-${stop.id}`}
                  name="promisedFor"
                  type="date"
                  defaultValue={stop.promisedFor ?? ""}
                />
              </Field>
            ) : null}

            <div className="sm:col-span-2">
              <Field
                label={es.collections.notes}
                htmlFor={`notes-${stop.id}`}
                hint={es.collections.notesHint}
              >
                <Textarea
                  id={`notes-${stop.id}`}
                  name="notes"
                  defaultValue={stop.notes ?? ""}
                  className="min-h-16"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={visit.pending}
            >
              {visit.pending ? es.common.saving : es.common.save}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
