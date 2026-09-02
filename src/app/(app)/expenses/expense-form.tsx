"use client";

import { Alert, Button, CardBody, Field, Input, Select } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import { createExpense, type ExpenseFormState } from "./actions";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? es.common.saving : es.expenses.new}
    </Button>
  );
}

export function ExpenseForm({
  categories,
  cashBoxes,
}: {
  categories: Array<{ id: string; label: string }>;
  cashBoxes: Array<{ id: string; label: string }>;
}) {
  const { state, pending, onSubmit } = useFormAction<ExpenseFormState>(createExpense, {});

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Field label={es.expenses.description} htmlFor="description" required>
            <Input id="description" name="description" required />
          </Field>
        </div>

        <Field label={es.common.amount} htmlFor="amount" required>
          <Input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
          />
        </Field>

        <Field label={es.expenses.spentAt} htmlFor="spentAt">
          <Input
            id="spentAt"
            name="spentAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        <Field label={es.expenses.category} htmlFor="categoryId">
          <Select id="categoryId" name="categoryId" defaultValue="">
            <option value="">{es.common.none}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={es.payments.cashBox} htmlFor="expenseCashBox">
          <Select id="expenseCashBox" name="cashBoxId" defaultValue="">
            <option value="">{es.common.none}</option>
            {cashBoxes.map((cashBox) => (
              <option key={cashBox.id} value={cashBox.id}>
                {cashBox.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton pending={pending} />
        </div>
      </CardBody>
    </form>
  );
}
