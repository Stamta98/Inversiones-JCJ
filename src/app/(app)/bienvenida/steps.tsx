"use client";

import {
  Alert,
  Button,
  CardBody,
  Field,
  Input,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  createFirstCashBox,
  type OnboardingFormState,
} from "./actions";

export function CashBoxStep({
  defaultName,
  currencySymbol,
  decimalPlaces,
}: {
  defaultName: string;
  currencySymbol: string;
  decimalPlaces: number;
}) {
  const { state, pending, onSubmit } = useFormAction<OnboardingFormState>(
    createFirstCashBox,
    {},
  );

  return (
    <form onSubmit={onSubmit}>
      <CardBody className="space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Field label={es.onboarding.cashBoxName} htmlFor="name" required>
          <Input id="name" name="name" defaultValue={defaultName} required autoFocus />
        </Field>

        <Field
          label={`${es.onboarding.openingBalance} (${currencySymbol})`}
          htmlFor="openingBalance"
          hint={es.onboarding.openingBalanceHint}
        >
          <Input
            id="openingBalance"
            name="openingBalance"
            type="number"
            inputMode="decimal"
            min="0"
            // Sin centavos donde la moneda no los usa.
            step={decimalPlaces === 0 ? "1" : "0.01"}
            defaultValue="0"
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? es.common.saving : es.common.next}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}
