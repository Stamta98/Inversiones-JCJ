"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { es } from "@/i18n/es";

import { createCustomer, type CustomerFormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? es.common.saving : es.common.save}
    </Button>
  );
}

export function CustomerForm() {
  const [state, formAction] = useActionState<CustomerFormState, FormData>(
    createCustomer,
    {},
  );
  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            label={es.customers.firstName}
            htmlFor="firstName"
            required
            error={fieldError("firstName")}
          >
            <Input id="firstName" name="firstName" required autoFocus />
          </Field>
          <Field
            label={es.customers.lastName}
            htmlFor="lastName"
            required
            error={fieldError("lastName")}
          >
            <Input id="lastName" name="lastName" required />
          </Field>
          <Field label={es.customers.documentType} htmlFor="documentType">
            <Input id="documentType" name="documentType" placeholder="Cédula" />
          </Field>
          <Field label={es.customers.documentNumber} htmlFor="documentNumber">
            <Input id="documentNumber" name="documentNumber" inputMode="numeric" />
          </Field>
          <Field
            label={es.customers.mobilePhone}
            htmlFor="mobilePhone"
            hint="Se usa para enviar los mensajes de cobro por WhatsApp."
          >
            <Input id="mobilePhone" name="mobilePhone" type="tel" inputMode="tel" />
          </Field>
          <Field label={es.customers.phone} htmlFor="phone">
            <Input id="phone" name="phone" type="tel" inputMode="tel" />
          </Field>
          <Field
            label={es.customers.email}
            htmlFor="email"
            error={fieldError("email")}
          >
            <Input id="email" name="email" type="email" autoCapitalize="none" />
          </Field>
          <Field label={es.customers.occupation} htmlFor="occupation">
            <Input id="occupation" name="occupation" />
          </Field>
          <Field label={es.customers.address} htmlFor="address">
            <Input id="address" name="address" />
          </Field>
          <Field label={es.customers.city} htmlFor="city">
            <Input id="city" name="city" />
          </Field>
          <Field label={es.customers.monthlyIncome} htmlFor="monthlyIncome">
            <Input
              id="monthlyIncome"
              name="monthlyIncome"
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={es.common.notes} htmlFor="notes">
              <Textarea id="notes" name="notes" />
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton />
      </div>
    </form>
  );
}
