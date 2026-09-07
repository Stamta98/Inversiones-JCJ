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
} from "@/components/ui";
import {
  ChargesField,
  summarizeRows,
  type ChargeRow,
} from "@/components/loans/charges-field";
import type { ChargeMode } from "@/core/loans/charges";
import { SchedulePreview } from "@/components/loans/schedule-preview";
import { NoCollectionDayError, firstDueAfter, parseDay } from "@/core/dates";
import { ScheduleError, buildSchedule } from "@/core/loans/schedule";
import { fromCents, stepForDecimals, toCents } from "@/core/money";
import {
  INTEREST_METHODS,
  LATE_FEE_MODES,
  PAYMENT_FREQUENCIES,
  isPercentLateFee,
  RATE_BASES,
  WEEKDAYS,
  type InterestMethod,
  type LateFeeMode,
  type PaymentFrequency,
  type RateBasis,
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
}

/**
 * Terms of an existing loan, when the form is used to edit one. Only reached
 * for a loan still in draft: `core/loans/editable` decides that, and the
 * server enforces it again.
 */
export interface LoanDefaults {
  id: string;
  customerId: string;
  guarantorId: string | null;
  principal: number;
  interestRate: number;
  rateBasis: RateBasis;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  customIntervalDays: number | null;
  nonCollectionDays: number[];
  termCount: number;
  /** ISO date, `YYYY-MM-DD`. */
  startDate: string;
  lateFeeMode: LateFeeMode;
  lateFeeValue: number;
  gracePeriodDays: number;
  charges: Array<{ name: string; amount: number; mode: ChargeMode }>;
}

export interface CashBoxOption {
  id: string;
  label: string;
}

/** El día de hoy, que es cuando se entrega la plata si no se dice otra cosa. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * La primera cuota que sale de un día de inicio.
 *
 * El día que se entrega no se cobra: diario es mañana, semanal es el mismo día
 * de la otra semana, mensual el mismo día del mes que viene. La regla vive en
 * el núcleo y aquí solo se pinta.
 */
function primeraCuota(
  inicio: string,
  frequency: PaymentFrequency,
  customIntervalDays: number,
  nonCollectionDays: number[],
): Date | null {
  const dia = parseDay(inicio);
  if (!dia) return null;
  try {
    return firstDueAfter(dia, frequency, {
      customIntervalDays,
      nonCollectionDays,
    });
  } catch {
    // Sin un solo día libre para cobrar no hay primera cuota que calcular.
    // Sin este intento, marcar los siete días de la semana reventaba el
    // formulario entero — «Application error» — y se perdía todo lo escrito.
    // Ahora no hay fecha, y el aviso de abajo dice por qué.
    return null;
  }
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
  locale,
  decimalPlaces,
  defaultCustomerId,
  loan,
}: {
  customers: CustomerOption[];
  cashBoxes: CashBoxOption[];
  currencyCode: string;
  /** Del contexto de la empresa: cómo se escriben los montos aquí. */
  locale: string;
  decimalPlaces: number;
  defaultCustomerId?: string;
  /** Present when editing an existing draft instead of creating a loan. */
  loan?: LoanDefaults;
}) {
  const editando = loan !== undefined;
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    editando ? updateLoanAction : createLoanAction,
    {},
  );

  // Vacíos y en cero: el monto y las cuotas los pone quien presta, y un
  // número puesto de antemano se le olvida a uno cambiarlo.
  const [principal, setPrincipal] = useState(
    loan ? String(loan.principal) : "0",
  );
  const [interestRate, setInterestRate] = useState(
    loan ? String(loan.interestRate) : "20",
  );
  const [rateBasis, setRateBasis] = useState<RateBasis>(
    loan?.rateBasis ?? "TOTAL",
  );
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(
    loan?.interestMethod ?? "FLAT",
  );
  // Diario, que es como se presta en la calle casi siempre.
  const [frequency, setFrequency] = useState<PaymentFrequency>(
    loan?.frequency ?? "DAILY",
  );
  const [termCount, setTermCount] = useState(
    loan ? String(loan.termCount) : "0",
  );
  const [startDate, setStartDate] = useState(loan?.startDate ?? hoy());
  const [customerId, setCustomerId] = useState(
    loan?.customerId ?? defaultCustomerId ?? "",
  );
  const [guarantorId, setGuarantorId] = useState(loan?.guarantorId ?? "");
  const [customIntervalDays, setCustomIntervalDays] = useState(
    loan?.customIntervalDays ? String(loan.customIntervalDays) : "10",
  );
  const [nonCollectionDays, setNonCollectionDays] = useState<number[]>(
    loan?.nonCollectionDays ?? [],
  );
  const [lateFeeMode, setLateFeeMode] = useState<LateFeeMode>(
    loan?.lateFeeMode ?? "NONE",
  );
  const [charges, setCharges] = useState<ChargeRow[]>(
    (loan?.charges ?? []).map((charge, index) => ({
      key: index + 1,
      name: charge.name,
      amount: String(charge.amount),
      mode: charge.mode,
    })),
  );

  const money = (value: number) =>
    formatCurrency(value, currencyCode, locale, decimalPlaces);

  const toggleNonCollectionDay = (day: number) => {
    const next = nonCollectionDays.includes(day)
      ? nonCollectionDays.filter((value) => value !== day)
      : [...nonCollectionDays, day].sort();
    setNonCollectionDays(next);
  };

  // The schedule engine is pure, so the preview runs in the browser with the
  // exact same code the server uses when the loan is saved.
  const chargeTotals = summarizeRows(charges);

  // La primera cuota sale del día de inicio y de la frecuencia. No se guarda
  // en un estado aparte: si se guardara, cambiar la frecuencia tendría que
  // acordarse de moverla, y ese olvido es lo que dejaba préstamos cobrando el
  // mismo día en que se entregaba la plata.
  const firstDue = useMemo(
    () =>
      primeraCuota(
        startDate,
        frequency,
        Number(customIntervalDays) || 1,
        nonCollectionDays,
      ),
    [startDate, frequency, customIntervalDays, nonCollectionDays],
  );

  // Sin ningún día libre no hay cómo armar el plan: se dice y no se calcula.
  const sinDiaParaCobrar = nonCollectionDays.length >= 7;

  // Si lo que se teclea en «Valor de la mora» es un porcentaje o son pesos.
  // Con el mismo rótulo para las dos cosas, un «2» quería decir dos por
  // ciento o dos pesos según el modo, y nadie podía saber cuál.
  const moraEnPorcentaje = isPercentLateFee(lateFeeMode);

  const preview = useMemo(() => {
    try {
      return {
        schedule: buildSchedule({
          principalCents: toCents(Number(principal) || 0),
          interestRate: Number(interestRate) || 0,
          rateBasis,
          interestMethod,
          frequency,
          termCount: Number(termCount) || 0,
          firstDueDate: firstDue ?? new Date(),
          customIntervalDays: Number(customIntervalDays) || 0,
          nonCollectionDays,
          // El mismo paso que usa el servidor, para que la vista previa no
          // muestre cuotas distintas de las que se van a guardar.
          minorUnitStep: stepForDecimals(decimalPlaces),
          // El cargo financiado se cobra con las cuotas, así que la vista
          // previa tiene que enseñarlo: si no, el total que se ve al guardar
          // no es el que se vio al decidir.
          financedChargeCents: toCents(chargeTotals.financed),
        }),
        error: null as string | null,
      };
    } catch (error) {
      const message =
        error instanceof ScheduleError
          ? ((es.loans.errors as Record<string, string>)[error.code] ??
            error.message)
          : error instanceof NoCollectionDayError
            ? es.loans.errors.nonCollectionDays
            : es.common.error;
      return { schedule: null, error: message };
    }
  }, [
    principal,
    interestRate,
    rateBasis,
    interestMethod,
    frequency,
    termCount,
    firstDue,
    customIntervalDays,
    nonCollectionDays,
    decimalPlaces,
    chargeTotals.financed,
  ]);

  const schedule = preview.schedule;

  // La cuota, sacada del mismo plan que se va a guardar. La última puede
  // quedar unos pesos distinta cuando el reparto no da exacto, y en ese caso
  // se dice: el cliente que la ve distinta pregunta.
  const cuota = schedule?.installments[0]?.totalCents ?? 0;
  const cuotaFinal =
    schedule?.installments[schedule.installments.length - 1]?.totalCents ?? 0;
  const cuotaDispareja = cuota > 0 && cuotaFinal !== cuota;

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      {editando ? <input type="hidden" name="loanId" value={loan.id} /> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={editando ? es.loans.edit : es.loans.new} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={es.loans.customer} htmlFor="customerId" required>
                  <Select
                    id="customerId"
                    name="customerId"
                    value={customerId}
                    onChange={(event) => {
                      setCustomerId(event.target.value);
                      // Si el nuevo cliente era el fiador, el fiador se
                      // borra: nadie se respalda a sí mismo, y dejarlo
                      // puesto guardaría a alguien que ya no está en la
                      // lista.
                      if (event.target.value === guarantorId)
                        setGuarantorId("");
                    }}
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

              {/* El fiador sale de los mismos clientes registrados: al que
                  respalda se le termina prestando, y así queda con su cédula
                  y su foto en vez de escrito a mano en dos partes. */}
              <div className="sm:col-span-2">
                <Field
                  label={es.loans.guarantor}
                  htmlFor="guarantorId"
                  hint={es.loans.guarantorHint}
                >
                  <Select
                    id="guarantorId"
                    name="guarantorId"
                    value={guarantorId}
                    onChange={(event) => setGuarantorId(event.target.value)}
                  >
                    <option value="">{es.loans.noGuarantor}</option>
                    {customers
                      // El que pide la plata no puede respaldarse a sí mismo.
                      .filter((customer) => customer.id !== customerId)
                      .map((customer) => (
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
                  step={decimalPlaces === 0 ? "1" : "0.01"}
                  min={decimalPlaces === 0 ? "1" : "0.01"}
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
                  onChange={(event) => {
                    setFrequency(event.target.value as PaymentFrequency);
                  }}
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

              {/* De a cuánto le queda la cuota, aquí mismo: es la cuenta que
                  la persona hace de cabeza al escribir cuántas son, y para
                  verla había que bajar hasta la tabla de todo el plan. No se
                  escribe — sale del capital, la tasa y las cuotas — así que
                  va en un campo que se lee y no se toca. */}
              <Field
                label={es.loans.installmentValue}
                htmlFor="installmentPreview"
                hint={
                  cuotaDispareja
                    ? es.loans.installmentValueLast.replace(
                        "{amount}",
                        money(fromCents(cuotaFinal)),
                      )
                    : es.loans.installmentValueHint
                }
              >
                <Input
                  id="installmentPreview"
                  readOnly
                  tabIndex={-1}
                  className="numeric bg-surface-muted font-semibold"
                  value={cuota > 0 ? money(fromCents(cuota)) : "—"}
                />
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
                {/* Qué día va a caer la primera cuota, dicho aquí mismo: es
                    la cuenta que hace la persona de cabeza al escribir la
                    fecha, y se mueve sola al cambiar la frecuencia. */}
                <p className="mt-1 text-xs text-ink-subtle">
                  {firstDue
                    ? es.loans.startDateHint.replace(
                        "{date}",
                        formatDate(firstDue, locale),
                      )
                    : sinDiaParaCobrar
                      ? es.loans.errors.nonCollectionDays
                      : es.loans.startDateHintEmpty}
                </p>
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

              <Field
                label={es.loans.lateFeeMode}
                htmlFor="lateFeeMode"
                hint={es.loans.lateFeeModeHint[lateFeeMode]}
              >
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
                  <Field
                    label={
                      moraEnPorcentaje
                        ? es.loans.lateFeeValueLabel.percent
                        : es.loans.lateFeeValueLabel.amount
                    }
                    htmlFor="lateFeeValue"
                  >
                    <Input
                      id="lateFeeValue"
                      name="lateFeeValue"
                      type="number"
                      inputMode="decimal"
                      // En pesos no hay centavos que teclear, y el «0,01» de
                      // antes invitaba a escribir una mora de un centavo.
                      step={
                        moraEnPorcentaje || decimalPlaces > 0 ? "0.01" : "1"
                      }
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={es.loans.charges.title}
              description={
                chargeTotals.deducted > 0
                  ? `${es.loans.charges.handedOver}: ${money(
                      Math.max(0, Number(principal) - chargeTotals.deducted),
                    )}`
                  : undefined
              }
            />
            <CardBody>
              <ChargesField
                rows={charges}
                onChange={setCharges}
                decimalPlaces={decimalPlaces}
              />
              {charges.length === 0 ? null : (
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-muted">
                      {es.loans.charges.deductedTotal}
                    </span>
                    <span className="tabular-nums">
                      {money(chargeTotals.deducted)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-muted">
                      {es.loans.charges.financedTotal}
                    </span>
                    <span className="tabular-nums">
                      {money(chargeTotals.financed)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <span className="font-medium text-ink">
                      {es.loans.charges.handedOver}
                    </span>
                    <span className="text-base font-bold tabular-nums text-brand">
                      {money(
                        Math.max(0, Number(principal) - chargeTotals.deducted),
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-ink-subtle">
                    {es.loans.charges.handedOverHint}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <SchedulePreview
          schedule={schedule}
          error={preview.error}
          money={money}
        />
      </div>

      <div className="flex justify-end">
        <SubmitButton pending={pending} />
      </div>
    </form>
  );
}
