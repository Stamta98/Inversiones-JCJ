"use client";

import { useMemo, useState } from "react";

import {
  ChargesField,
  summarizeRows,
  type ChargeRow,
} from "@/components/loans/charges-field";
import { SchedulePreview } from "@/components/loans/schedule-preview";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { RenewalError, planRenewal, type RenewalKind } from "@/core/loans/renewal";
import { ScheduleError, buildSchedule } from "@/core/loans/schedule";
import { fromCents, stepForDecimals, toCents } from "@/core/money";
import {
  INTEREST_METHODS,
  PAYMENT_FREQUENCIES,
  RATE_BASES,
  type InterestMethod,
  type LateFeeMode,
  type PaymentFrequency,
  type RateBasis,
} from "@/core/types";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import { renewLoanAction, type LoanFormState } from "../../actions";

export interface RenewableLoan {
  id: string;
  code: string;
  customerName: string;
  outstanding: number;
  principal: number;
  interestRate: number;
  rateBasis: RateBasis;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  customIntervalDays: number | null;
  nonCollectionDays: number[];
  termCount: number;
  lateFeeMode: LateFeeMode;
  lateFeeValue: number;
  gracePeriodDays: number;
}

export interface CashBoxOption {
  id: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Refinanciar o renovar un préstamo.
 *
 * Las dos cosas terminan igual — el saldo viejo pasa a un préstamo nuevo — y
 * se diferencian en la plata: refinanciar no mueve nada, renovar entrega la
 * diferencia. Por eso la cuenta va arriba y en grande: es el número que el
 * cobrador tiene que sacar del bolsillo.
 *
 * Las condiciones vienen del préstamo que se está reemplazando, que casi
 * siempre es lo que se quiere; se pueden cambiar todas antes de guardar.
 */
export function RenewForm({
  loan,
  cashBoxes,
  currencyCode,
  locale,
  decimalPlaces,
}: {
  loan: RenewableLoan;
  cashBoxes: CashBoxOption[];
  currencyCode: string;
  locale: string;
  decimalPlaces: number;
}) {
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    renewLoanAction,
    {},
  );

  const [kind, setKind] = useState<RenewalKind>("REFINANCE");
  const [principal, setPrincipal] = useState(String(loan.principal));
  const [interestRate, setInterestRate] = useState(String(loan.interestRate));
  const [rateBasis, setRateBasis] = useState<RateBasis>(loan.rateBasis);
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(
    loan.interestMethod,
  );
  const [frequency, setFrequency] = useState<PaymentFrequency>(loan.frequency);
  const [termCount, setTermCount] = useState(String(loan.termCount));
  const [firstDueDate, setFirstDueDate] = useState(todayIso());
  const [customIntervalDays, setCustomIntervalDays] = useState(
    loan.customIntervalDays ? String(loan.customIntervalDays) : "10",
  );
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const chargeTotals = summarizeRows(charges);

  const money = (value: number) =>
    formatCurrency(value, currencyCode, locale, decimalPlaces);
  const step = stepForDecimals(decimalPlaces);

  // La misma función que decide en el servidor, así que la cuenta que se ve
  // aquí es exactamente la que se va a guardar.
  const plan = useMemo(() => {
    try {
      return {
        value: planRenewal({
          kind,
          outstandingCents: toCents(loan.outstanding),
          newPrincipalCents:
            kind === "RENEWAL" ? toCents(Number(principal) || 0) : undefined,
          step,
        }),
        error: null as string | null,
      };
    } catch (error) {
      const message =
        error instanceof RenewalError
          ? ((es.loans.errors as Record<string, string>)[error.code] ??
            error.message)
          : es.common.error;
      return { value: null, error: message };
    }
  }, [kind, principal, loan.outstanding, step]);

  const preview = useMemo(() => {
    if (!plan.value) return { schedule: null, error: null as string | null };
    try {
      return {
        schedule: buildSchedule({
          principalCents: plan.value.newPrincipalCents,
          interestRate: Number(interestRate) || 0,
          rateBasis,
          interestMethod,
          frequency,
          termCount: Number(termCount) || 0,
          firstDueDate: new Date(`${firstDueDate}T00:00:00.000Z`),
          customIntervalDays: Number(customIntervalDays) || 0,
          nonCollectionDays: loan.nonCollectionDays,
          minorUnitStep: step,
          financedChargeCents: toCents(chargeTotals.financed),
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
    plan.value,
    interestRate,
    rateBasis,
    interestMethod,
    frequency,
    termCount,
    firstDueDate,
    customIntervalDays,
    loan.nonCollectionDays,
    step,
    chargeTotals.financed,
  ]);

  const renewing = kind === "RENEWAL";

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="loanId" value={loan.id} />
      <input type="hidden" name="kind" value={kind} />
      {/* Se heredan del préstamo que se reemplaza; se ven en el resumen. */}
      <input type="hidden" name="lateFeeMode" value={loan.lateFeeMode} />
      <input type="hidden" name="lateFeeValue" value={loan.lateFeeValue} />
      <input
        type="hidden"
        name="gracePeriodDays"
        value={loan.gracePeriodDays}
      />
      {loan.nonCollectionDays.map((day) => (
        <input key={day} type="hidden" name="nonCollectionDays" value={day} />
      ))}

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={es.loans.renewal.kind} />
            <CardBody className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {(["REFINANCE", "RENEWAL"] as RenewalKind[]).map((option) => (
                  <label
                    key={option}
                    className={
                      "cursor-pointer rounded-xl border p-3 text-sm transition-colors " +
                      (kind === option
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border text-ink hover:border-brand")
                    }
                  >
                    <input
                      type="radio"
                      name="kindChoice"
                      value={option}
                      checked={kind === option}
                      onChange={() => setKind(option)}
                      className="sr-only"
                    />
                    <span className="block font-semibold">
                      {es.loans.renewal.kindLabel[option]}
                    </span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {es.loans.renewal.kindHint[option]}
                    </span>
                  </label>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={es.loans.renewal.summaryTitle} />
            <CardBody className="space-y-3">
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">
                    {es.loans.renewal.settled}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {money(loan.outstanding)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{es.loans.principal}</dt>
                  <dd className="font-semibold tabular-nums">
                    {plan.value ? money(fromCents(plan.value.newPrincipalCents)) : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                  <dt className="font-medium text-ink">
                    {es.loans.renewal.cashOut}
                  </dt>
                  <dd className="text-lg font-bold tabular-nums text-brand">
                    {plan.value
                      ? money(
                          Math.max(
                            0,
                            fromCents(plan.value.cashOutCents) -
                              chargeTotals.deducted,
                          ),
                        )
                      : "—"}
                  </dd>
                </div>
              </dl>
              {plan.error ? (
                <Alert tone="danger">{plan.error}</Alert>
              ) : plan.value?.cashOutCents === 0 ? (
                <Alert tone="info">{es.loans.renewal.cashOutNone}</Alert>
              ) : (
                <p className="text-xs text-ink-subtle">
                  {es.loans.renewal.cashOutHint}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={es.loans.new} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {renewing ? (
                <div className="sm:col-span-2">
                  <Field
                    label={es.loans.renewal.newPrincipal}
                    htmlFor="principal"
                    hint={es.loans.renewal.newPrincipalHint}
                    required
                  >
                    <Input
                      id="principal"
                      name="principal"
                      type="number"
                      inputMode="decimal"
                      step={decimalPlaces === 0 ? "1" : "0.01"}
                      min={decimalPlaces === 0 ? "1" : "0.01"}
                      required
                      value={principal}
                      onChange={(event) => setPrincipal(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

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

              <div className="sm:col-span-2">
                <Field
                  label={es.loans.rateBasis}
                  htmlFor="rateBasis"
                  hint={es.loans.rateBasisHint[rateBasis]}
                >
                  <Select
                    id="rateBasis"
                    name="rateBasis"
                    value={rateBasis}
                    onChange={(event) =>
                      setRateBasis(event.target.value as RateBasis)
                    }
                  >
                    {RATE_BASES.map((basis) => (
                      <option key={basis} value={basis}>
                        {es.loans.rateBasisLabel[basis]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

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

              <Field label={es.loans.firstDueDate} htmlFor="firstDueDate" required>
                <Input
                  id="firstDueDate"
                  name="firstDueDate"
                  type="date"
                  required
                  value={firstDueDate}
                  onChange={(event) => setFirstDueDate(event.target.value)}
                />
              </Field>

              {frequency === "CUSTOM" ? (
                <Field
                  label={es.loans.customIntervalDays}
                  htmlFor="customIntervalDays"
                  hint={es.loans.customIntervalHint}
                >
                  <Input
                    id="customIntervalDays"
                    name="customIntervalDays"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    value={customIntervalDays}
                    onChange={(event) =>
                      setCustomIntervalDays(event.target.value)
                    }
                  />
                </Field>
              ) : null}

              {/* Una refinanciación no mueve plata, así que no pide caja. */}
              {renewing && cashBoxes.length > 0 ? (
                <div className="sm:col-span-2">
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
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <Field label={es.common.notes} htmlFor="notes">
                  <Textarea id="notes" name="notes" />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={es.loans.charges.title} />
            <CardBody>
              <ChargesField
                rows={charges}
                onChange={setCharges}
                decimalPlaces={decimalPlaces}
              />
            </CardBody>
          </Card>
        </div>

        <SchedulePreview
          schedule={preview.schedule}
          error={preview.error}
          money={money}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || plan.value === null}>
          {pending
            ? es.common.saving
            : renewing
              ? es.loans.renewal.confirmRenewal
              : es.loans.renewal.confirmRefinance}
        </Button>
      </div>
    </form>
  );
}
