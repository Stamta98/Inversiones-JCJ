"use client";

import { Alert, Button, CardBody, Field, Input, Select } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  createCashBox,
  createCashMovement,
  type CashFormState,
} from "./actions";

function SubmitButton({
  label,
  pending,
}: {
  label: string;
  pending: boolean;
}) {
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? es.common.saving : label}
    </Button>
  );
}

export function CashBoxForm() {
  const { state, pending, onSubmit } = useFormAction<CashFormState>(createCashBox, {});

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.cash.name} htmlFor="cashBoxName" required>
          <Input id="cashBoxName" name="name" required />
        </Field>

        <Field label={es.cash.kind} htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="CASH">
            <option value="CASH">{es.cash.kindLabel.CASH}</option>
            <option value="BANK">{es.cash.kindLabel.BANK}</option>
          </Select>
        </Field>

        <Field label={es.cash.accountNumber} htmlFor="accountNumber">
          <Input id="accountNumber" name="accountNumber" />
        </Field>

        <Field label={es.cash.balance} htmlFor="openingBalance">
          <Input
            id="openingBalance"
            name="openingBalance"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            defaultValue="0"
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton label={es.cash.new} pending={pending} />
        </div>
      </CardBody>
    </form>
  );
}

export function MovementForm({
  cashBoxes,
}: {
  cashBoxes: Array<{ id: string; label: string }>;
}) {
  const { state, pending, onSubmit } = useFormAction<CashFormState>(createCashMovement, {});

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.cash.singular} htmlFor="movementCashBox" required>
          <Select id="movementCashBox" name="cashBoxId" required>
            {cashBoxes.map((cashBox) => (
              <option key={cashBox.id} value={cashBox.id}>
                {cashBox.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={es.common.actions} htmlFor="movementKind">
          <Select id="movementKind" name="kind" defaultValue="DEPOSIT">
            <option value="DEPOSIT">{es.cash.deposit}</option>
            <option value="WITHDRAWAL">{es.cash.withdrawal}</option>
            <option value="ADJUSTMENT">
              {es.cash.movementLabel.ADJUSTMENT}
            </option>
          </Select>
        </Field>

        <Field label={es.common.amount} htmlFor="movementAmount" required>
          <Input
            id="movementAmount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
          />
        </Field>

        <Field label={es.expenses.description} htmlFor="movementDescription">
          <Input id="movementDescription" name="description" />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton label={es.common.save} pending={pending} />
        </div>
      </CardBody>
    </form>
  );
}
