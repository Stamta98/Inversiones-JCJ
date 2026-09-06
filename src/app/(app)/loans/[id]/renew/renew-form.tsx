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
} from "@/components/ui";
import {
  RenewalError,
  planRenewal,
  type RenewalKind,
} from "@/core/loans/renewal";
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
import { firstDueAfter, parseDay } from "@/core/dates";
import { es } from "@/i18n/es";
import { formatCurrency, formatDate } from "@/lib/format";
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
  kind = "REFINANCE",
}: {
  loan: RenewableLoan;
  cashBoxes: CashBoxOption[];
  currencyCode: string;
  locale: string;
  decimalPlaces: number;
  /**
   * Cuál de las dos se va a hacer. Se escoge en el menú del préstamo, no
   * aquí: quien entró a refinanciar viene a refinanciar, y poner las dos
   * al lado solo daba ocasión de tocar la que no era.
   */
  kind?: RenewalKind;
}) {
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    renewLoanAction,
    {},
  );

  const [principal, setPrincipal] = useState(String(loan.principal));
  const [interestRate, setInterestRate] = useState(String(loan.interestRate));
  const [rateBasis, setRateBasis] = useState<RateBasis>(loan.rateBasis);
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(
    loan.interestMethod,
  );
  const [frequency, setFrequency] = useState<PaymentFrequency>(loan.frequency);
  const [termCount, setTermCount] = useState(String(loan.termCount));
  const [startDate, setStartDate] = useState(todayIso());
  const [customIntervalDays, setCustomIntervalDays] = useState(
    loan.customIntervalDays ? String(loan.customIntervalDays) : "10",
  );
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const chargeTotals = summarizeRows(charges);

  // Renovar entrega plata de nuevo, así que vale la misma regla: el día que
  // se entrega no se cobra. Antes esta pantalla ponía la primera cuota hoy y
  // creaba justo los préstamos torcidos que hubo que corregir después.
  const firstDue = useMemo(() => {
    const dia = parseDay(startDate);
    if (!dia) return null;
    try {
      return firstDueAfter(dia, frequency, {
        customIntervalDays: Number(customIntervalDays) || 1,
        nonCollectionDays: loan.nonCollectionDays,
      });
    } catch {
      // Un préstamo viejo sin un solo día libre para cobrar tumbaba esta
      // pantalla al abrirla. Sin fecha se sigue pudiendo leer y corregir.
      return null;
    }
  }, [startDate, frequency, customIntervalDays, loan.nonCollectionDays]);

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
          firstDueDate: firstDue ?? new Date(),
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
    firstDue,
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
          {/* Lo que se va a hacer, dicho y no preguntado: se escogió en el
              menú del préstamo. Para cambiar de idea se sale y se entra por
              la otra, que es una decisión de las que conviene volver a
              tomar a propósito. */}
          <Card>
            <CardHeader title={es.loans.renewal.kindLabel[kind]} />
            <CardBody>
              <p className="text-sm text-ink-muted">
                {es.loans.renewal.kindHint[kind]}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={es.loans.renewal.summaryTitle} />
            <CardBody className="space-y-3">
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{es.loans.renewal.settled}</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(loan.outstanding)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{es.loans.principal}</dt>
                  <dd className="font-semibold tabular-nums">
                    {plan.value
                      ? money(fromCents(plan.value.newPrincipalCents))
                      : "—"}
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

              <Field label={es.loans.startDate} htmlFor="startDate" required>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
                <p className="mt-1 text-xs text-ink-subtle">
                  {firstDue
                    ? es.loans.startDateHint.replace(
                        "{date}",
                        formatDate(firstDue, locale),
                      )
                    : es.loans.startDateHintEmpty}
                </p>
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
                    {/* Con "Ninguno" por defecto, la plata salía sin que la
                        caja se enterara y el resumen del día pedía entregar
                        lo que ya se había entregado. El cobro ya venía con la
                        caja puesta; el préstamo también. */}
                    <Select
                      id="cashBoxId"
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
                </div>
              ) : null}
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
