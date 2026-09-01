"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

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
import { ScheduleError, buildSchedule } from "@/core/loans/schedule";
import { fromCents, toCents } from "@/core/money";
import {
  INTEREST_METHODS,
  LATE_FEE_MODES,
  PAYMENT_FREQUENCIES,
  type InterestMethod,
  type LateFeeMode,
  type PaymentFrequency,
} from "@/core/types";
import { es } from "@/i18n/es";
import { formatCurrency, formatDate } from "@/lib/format";

import { createLoanAction, type LoanFormState } from "../actions";

export interface CustomerOption {
  id: string;
  label: string;
}

export interface CashBoxOption {
  id: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function SubmitButton() {
  const { pending } = useFormStatus();
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
}: {
  customers: CustomerOption[];
  cashBoxes: CashBoxOption[];
  currencyCode: string;
  defaultCustomerId?: string;
}) {
  const [state, formAction] = useActionState<LoanFormState, FormData>(
    createLoanAction,
    {},
  );

  const [principal, setPrincipal] = useState("10000");
  const [interestRate, setInterestRate] = useState("10");
  const [interestMethod, setInterestMethod] = useState<InterestMethod>("FLAT");
  const [frequency, setFrequency] = useState<PaymentFrequency>("MONTHLY");
  const [termCount, setTermCount] = useState("12");
  const [firstDueDate, setFirstDueDate] = useState(todayIso());
  const [lateFeeMode, setLateFeeMode] = useState<LateFeeMode>("NONE");

  const money = (value: number) => formatCurrency(value, currencyCode);

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
  }, [principal, interestRate, interestMethod, frequency, termCount, firstDueDate]);

  const schedule = preview.schedule;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={es.loans.new} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={es.loans.customer} htmlFor="customerId" required>
                <Select
                  id="customerId"
                  name="customerId"
                  defaultValue={defaultCustomerId ?? ""}
                  required
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
            </Field>

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
                    defaultValue="0"
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
                    defaultValue="0"
                  />
                </Field>
              </>
            ) : (
              <>
                <input type="hidden" name="lateFeeValue" value="0" />
                <input type="hidden" name="gracePeriodDays" value="0" />
              </>
            )}

            {cashBoxes.length > 0 ? (
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
                <Textarea id="notes" name="notes" />
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
                <TableWrap>
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
        <SubmitButton />
      </div>
    </form>
  );
}
