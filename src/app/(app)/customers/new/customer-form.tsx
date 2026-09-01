"use client";

import { useActionState, useState } from "react";
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
  Textarea,
} from "@/components/ui";
import { es } from "@/i18n/es";

import { createCustomer, type CustomerFormState } from "../actions";

const EMPLOYMENT_TYPES = ["INDEPENDENT", "EMPLOYEE", "OTHER"] as const;

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
  const [employmentType, setEmploymentType] = useState<string>("");
  const fieldError = (name: string) => state.fieldErrors?.[name];

  // The employer only makes sense for someone on a payroll.
  const isEmployee = employmentType === "EMPLOYEE";

  return (
    <form action={formAction} className="max-w-4xl space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardHeader title={es.customers.personalSection} />
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
            <Input
              id="documentNumber"
              name="documentNumber"
              inputMode="numeric"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={es.customers.contactSection} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            label={es.customers.mobilePhone}
            htmlFor="mobilePhone"
            hint="Se usa para enviar los mensajes de cobro por WhatsApp."
          >
            <Input
              id="mobilePhone"
              name="mobilePhone"
              type="tel"
              inputMode="tel"
            />
          </Field>
          <Field label={es.customers.phone} htmlFor="phone">
            <Input id="phone" name="phone" type="tel" inputMode="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={es.customers.email}
              htmlFor="email"
              error={fieldError("email")}
            >
              <Input
                id="email"
                name="email"
                type="email"
                autoCapitalize="none"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={es.customers.homeSection} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={es.customers.address} htmlFor="address">
              <Input
                id="address"
                name="address"
                placeholder="Calle y número"
              />
            </Field>
          </div>
          <Field
            label={es.customers.neighborhood}
            htmlFor="neighborhood"
            hint="Ayuda al cobrador a ubicar al cliente."
          >
            <Input id="neighborhood" name="neighborhood" />
          </Field>
          <Field label={es.customers.city} htmlFor="city">
            <Input id="city" name="city" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={es.customers.workSection} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={es.customers.employmentType} htmlFor="employmentType">
            <Select
              id="employmentType"
              name="employmentType"
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
            >
              <option value="">{es.common.selectOne}</option>
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {es.customers.employmentTypeLabel[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={es.customers.occupation} htmlFor="occupation">
            <Input
              id="occupation"
              name="occupation"
              placeholder="Comerciante, chofer, estilista…"
            />
          </Field>

          {isEmployee ? (
            <div className="sm:col-span-2">
              <Field label={es.customers.employerName} htmlFor="employerName">
                <Input id="employerName" name="employerName" />
              </Field>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Field label={es.customers.workAddress} htmlFor="workAddress">
              <Input id="workAddress" name="workAddress" />
            </Field>
          </div>

          <Field
            label={es.customers.workNeighborhood}
            htmlFor="workNeighborhood"
          >
            <Input id="workNeighborhood" name="workNeighborhood" />
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={es.common.notes} />
        <CardBody>
          <Field label={es.common.notes} htmlFor="notes">
            <Textarea id="notes" name="notes" />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton />
      </div>
    </form>
  );
}
