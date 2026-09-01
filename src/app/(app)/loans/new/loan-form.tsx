"use client";

import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
  TableWrap,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import {
  suggestFirstDueDate,
  type Payday,
} from "@/core/customers/payday";
import { ScheduleError, buildSchedule } from "@/core/loans/schedule";
import { fromCents, toCents } from "@/core/money";
import {
  INTEREST_METHODS,
  LATE_FEE_MODES,
  PAYMENT_FREQUENCIES,
  WEEKDAYS,
  type InterestMethod,
  type LateFeeMode,
  type PaymentFrequency,
} from "@/core/types";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";
import { formatCurrency, formatDate } from "@/lib/format";

import {
  createLoanAction,
  updateLoanAction,
  type LoanFormState,
} from "../actions";

export interface CustomerOption {
  id: string;
  label: string;
  payday: Payday;
}

/**
 * Terms of an existing loan, when the form is used to edit one. Only reached
 * for a loan still in draft: `core/loans/editable` decides that, and the
 * server enforces it again.
 */
export interface LoanDefaults {
  id: string;
  customerId: string;
  principal: number;
  interestRate: number;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  customIntervalDays: number | null;
  nonCollectionDays: number[];
  termCount: number;
  /** ISO date, `YYYY-MM-DD`. */
  firstDueDate: string;
  lateFeeMode: LateFeeMode;
  lateFeeValue: number;
  gracePeriodDays: number;
  notes: string | null;
}

export interface CashBoxOption {
  id: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? es.common.saving : es.common.save}
    </Button>
  );
}

export function LoanForm({
  customers,
  cashBoxes,
  currencyCode,
  defaultCustomerId,
  loan,
}: {
  customers: CustomerOption[];
  cashBoxes: CashBoxOption[];
  currencyCode: string;
  defaultCustomerId?: string;
  /** Present when editing an existing draft instead of creating a loan. */
  loan?: LoanDefaults;
}) {
  const editando = loan !== undefined;
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    editando ? updateLoanAction : createLoanAction,
    {},
  );

  const [principal, setPrincipal] = useState(
    loan ? String(loan.principal) : "10000",
  );
  const [interestRate, setInterestRate] = useState(
    loan ? String(loan.interestRate) : "10",
  );
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(
    loan?.interestMethod ?? "FLAT",
  );
  const [frequency, setFrequency] = useState<PaymentFrequency>(
    loan?.frequency ?? "MONTHLY",
  );
  const [termCount, setTermCount] = useState(
    loan ? String(loan.termCount) : "12",
  );
  const [firstDueDate, setFirstDueDate] = useState(
    loan?.firstDueDate ?? todayIso(),
  );
  const [customerId, setCustomerId] = useState(
    loan?.customerId ?? defaultCustomerId ?? "",
  );
  const [customIntervalDays, setCustomIntervalDays] = useState(
    loan?.customIntervalDays ? String(loan.customIntervalDays) : "10",
  );
  const [nonCollectionDays, setNonCollectionDays] = useState<number[]>(
    loan?.nonCollectionDays ?? [],
  );
  const [lateFeeMode, setLateFeeMode] = useState<LateFeeMode>(
    loan?.lateFeeMode ?? "NONE",
  );

  const toggleNonCollectionDay = (day: number) =>
    setNonCollectionDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );

  const money = (value: number) => formatCurrency(value, currencyCode);

  /**
   * First due date suggested from the customer's payday, so the installment
   * lands while they still have the money in hand.
   */
  const suggestedDate = useMemo(() => {
    const customer = customers.find((option) => option.id === customerId);
    if (!customer) return null;

    const suggestion = suggestFirstDueDate(customer.payday, new Date(), {
      nonCollectionDays,
    });
    if (!suggestion) return null;

    const iso = suggestion.toISOString().slice(0, 10);
    return iso === firstDueDate ? null : iso;
  }, [customers, customerId, nonCollectionDays, firstDueDate]);

  // The schedule engine is pure, so the preview runs in the browser with the
  // exact same code the server uses when the loan is saved.
  const preview = useMemo(() => {
    try {
      return {
        schedule: buildSchedule({
          principalCents: toCents(Number(principal) || 0),
          interestRate: Number(interestRate) || 0,
          interestMethod,
          frequency,
          termCount: Number(termCount) || 0,
          firstDueDate: new Date(`${firstDueDate}T00:00:00.000Z`),
          customIntervalDays: Number(customIntervalDays) || 0,
          nonCollectionDays,
        }),
        error: null as string | null,
      };
    } catch (error) {
      const message =
        error instanceof ScheduleError
          ? ((es.loans.errors as Record<string, string>)[error.code] ??
            error.message)
          : es.common.error;
      return { schedule: null, error: message };
    }
  }, [
    principal,
    interestRate,
    interestMethod,
    frequency,
    termCount,
    firstDueDate,
    customIntervalDays,
    nonCollectionDays,
  ]);

  const schedule = preview.schedule;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {editando ? <input type="hidden" name="loanId" value={loan.id} /> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={editando ? es.loans.edit : es.loans.new} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={es.loans.customer} htmlFor="customerId" required>
                <Select
                  id="customerId"
                  name="customerId"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  required
                  // Un préstamo no cambia de dueño; para eso se anula y se
                  // crea otro a nombre del cliente correcto.
                  disabled={editando}
                >
                  <option value="" disabled>
                    {es.common.selectOne}
                  </option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={es.loans.principal} htmlFor="principal" required>
              <Input
                id="principal"
                name="principal"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                value={principal}
                onChange={(event) => setPrincipal(event.target.value)}
              />
            </Field>

            <Field
              label={es.loans.interestRate}
              htmlFor="interestRate"
              hint={es.loans.interestRateHint}
              required
            >
              <Input
                id="interestRate"
                name="interestRate"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                value={interestRate}
                onChange={(event) => setInterestRate(event.target.value)}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label={es.loans.interestMethod} htmlFor="interestMethod">
                <Select
                  id="interestMethod"
                  name="interestMethod"
                  value={interestMethod}
                  onChange={(event) =>
                    setInterestMethod(event.target.value as InterestMethod)
                  }
                >
                  {INTEREST_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {es.loans.method[method]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={es.loans.frequency} htmlFor="frequency">
              <Select
                id="frequency"
                name="frequency"
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as PaymentFrequency)
                }
              >
                {PAYMENT_FREQUENCIES.map((option) => (
                  <option key={option} value={option}>
                    {es.loans.frequencyLabel[option]}
                  </option>
                ))}
              </Select>
            </Field>

            {frequency === "CUSTOM" ? (
              <Field
                label={es.loans.customIntervalDays}
                htmlFor="customIntervalDays"
                hint={es.loans.customIntervalHint}
                required
              >
                <Input
                  id="customIntervalDays"
                  name="customIntervalDays"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  required
                  value={customIntervalDays}
                  onChange={(event) =>
                    setCustomIntervalDays(event.target.value)
                  }
                />
              </Field>
            ) : null}

            <Field label={es.loans.termCount} htmlFor="termCount" required>
              <Input
                id="termCount"
                name="termCount"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                required
                value={termCount}
                onChange={(event) => setTermCount(event.target.value)}
              />
            </Field>

            <Field label={es.loans.firstDueDate} htmlFor="firstDueDate" required>
              <Input
                id="firstDueDate"
                name="firstDueDate"
                type="date"
                required
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
              {suggestedDate ? (
                <p className="mt-1 text-xs text-ink-subtle">
                  {es.loans.suggestedFirstDueDate.replace(
                    "{date}",
                    formatDate(new Date(`${suggestedDate}T00:00:00.000Z`)),
                  )}{" "}
                  <button
                    type="button"
                    onClick={() => setFirstDueDate(suggestedDate)}
                    className="font-medium text-brand-strong hover:underline"
                  >
                    {es.loans.useSuggestedDate}
                  </button>
                </p>
              ) : null}
            </Field>

            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                {es.loans.nonCollectionDays}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const isBlocked = nonCollectionDays.includes(day);
                  return (
                    <label
                      key={day}
                      className={
                        "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                        (isBlocked
                          ? "border-danger bg-danger-soft text-danger"
                          : "border-border text-ink-muted hover:border-brand")
                      }
                    >
                      <input
                        type="checkbox"
                        name="nonCollectionDays"
                        value={day}
                        checked={isBlocked}
                        onChange={() => toggleNonCollectionDay(day)}
                        className="sr-only"
                      />
                      {es.loans.weekdayShort[String(day) as "0"]}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-ink-subtle">
                {nonCollectionDays.length === 0
                  ? es.loans.nonCollectionNone
                  : es.loans.nonCollectionHint}
              </p>
            </div>

            <Field label={es.loans.lateFeeMode} htmlFor="lateFeeMode">
              <Select
                id="lateFeeMode"
                name="lateFeeMode"
                value={lateFeeMode}
                onChange={(event) =>
                  setLateFeeMode(event.target.value as LateFeeMode)
                }
              >
                {LATE_FEE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {es.loans.lateFeeModeLabel[mode]}
                  </option>
                ))}
              </Select>
            </Field>

            {lateFeeMode !== "NONE" ? (
              <>
                <Field label={es.loans.lateFeeValue} htmlFor="lateFeeValue">
                  <Input
                    id="lateFeeValue"
                    name="lateFeeValue"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    defaultValue={String(loan?.lateFeeValue ?? 0)}
                  />
                </Field>
                <Field
                  label={es.loans.gracePeriodDays}
                  htmlFor="gracePeriodDays"
                >
                  <Input
                    id="gracePeriodDays"
                    name="gracePeriodDays"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    defaultValue={String(loan?.gracePeriodDays ?? 0)}
                  />
                </Field>
              </>
            ) : (
              <>
                <input type="hidden" name="lateFeeValue" value="0" />
                <input type="hidden" name="gracePeriodDays" value="0" />
              </>
            )}

            {/* El desembolso se hace desde la ficha del préstamo, no al editarlo. */}
            {!editando && cashBoxes.length > 0 ? (
              <div className="sm:col-span-2 space-y-3">
                <Field label={es.payments.cashBox} htmlFor="cashBoxId">
                  <Select id="cashBoxId" name="cashBoxId" defaultValue="">
                    <option value="">{es.common.none}</option>
                    {cashBoxes.map((cashBox) => (
                      <option key={cashBox.id} value={cashBox.id}>
                        {cashBox.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="disburseNow"
                    className="size-4 rounded border-border"
                  />
                  {es.loans.disburse}
                </label>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <Field label={es.common.notes} htmlFor="notes">
                <Textarea id="notes" name="notes" defaultValue={loan?.notes ?? ""} />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={es.loans.schedulePreview}
            description={
              schedule
                ? `${es.loans.totalToPay}: ${money(fromCents(schedule.totalToPayCents))} · ${es.loans.totalInterest}: ${money(fromCents(schedule.totalInterestCents))}`
                : undefined
            }
          />
          {preview.error ? (
            <CardBody>
              <Alert tone="danger">{preview.error}</Alert>
            </CardBody>
          ) : schedule ? (
            <>
              {schedule.isOpenEnded ? (
                <CardBody className="pb-0">
                  <Alert tone="info" icon="clock">
                    {es.loans.openEndedNotice}
                  </Alert>
                </CardBody>
              ) : null}
              <div className="max-h-[28rem] overflow-y-auto">
                <TableWrap dense>
                  <thead className="sticky top-0 bg-surface">
                    <tr>
                      <Th>{es.loans.installment}</Th>
                      <Th>{es.loans.dueDate}</Th>
                      <Th align="right">{es.loans.principalPart}</Th>
                      <Th align="right">{es.loans.interestPart}</Th>
                      <Th align="right">{es.loans.installmentTotal}</Th>
                      <Th align="right">{es.loans.balanceAfter}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.installments.map((installment) => (
                      <tr key={installment.number}>
                        <Td numeric>{installment.number}</Td>
                        <Td numeric>{formatDate(installment.dueDate)}</Td>
                        <Td align="right" numeric>
                          {money(fromCents(installment.principalCents))}
                        </Td>
                        <Td align="right" numeric>
                          {money(fromCents(installment.interestCents))}
                        </Td>
                        <Td align="right" numeric className="font-medium">
                          {money(fromCents(installment.totalCents))}
                        </Td>
                        <Td align="right" numeric>
                          {money(fromCents(installment.balanceAfterCents))}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
            </>
          ) : null}
        </Card>
      </div>

      <div className="flex justify-end">
        <SubmitButton pending={pending} />
      </div>
    </form>
  );
}
