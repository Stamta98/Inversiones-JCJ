"use client";

import { useState } from "react";

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
import { LocationField } from "@/components/ui/location-field";
import { PhotoUpload } from "@/components/ui/photo-upload";

import { GENDERS } from "@/core/customers/identity";
import type { PaydayKind } from "@/core/customers/payday";
import { NATIONALITY_SUGGESTIONS } from "@/core/locales/nationalities";

import { PaydayFields } from "./payday-fields";
import { ReferenceFields } from "./reference-fields";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  createCustomer,
  updateCustomer,
  type CustomerFormState,
} from "../actions";
import type { ReferenceValue } from "./reference-fields";

/** Valores actuales del cliente, cuando el formulario se usa para editar. */
export interface CustomerDefaults {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  /** Calendar day as "YYYY-MM-DD", which is what a date input reads. */
  birthDate: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  address: string | null;
  neighborhood: string | null;
  landmark: string | null;
  city: string | null;
  employmentType: string | null;
  occupation: string | null;
  employerName: string | null;
  workAddress: string | null;
  workNeighborhood: string | null;
  workLandmark: string | null;
  monthlyIncome: number | null;
  paydayKind: string | null;
  paydayWeekday: number | null;
  paydayDayOfMonth: number | null;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  workLatitude: number | null;
  workLongitude: number | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  references: ReferenceValue[];
}

/** Una foto ya guardada, en la forma que espera `PhotoUpload`. */
function storedPhoto(url: string | null | undefined) {
  return url
    ? { url, name: "foto", mimeType: "image/jpeg", sizeBytes: 0 }
    : null;
}

/** Coordenadas ya guardadas, o null si nunca se capturó la ubicación. */
function storedPoint(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  return latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined
    ? { latitude, longitude }
    : null;
}

const EMPLOYMENT_TYPES = ["INDEPENDENT", "EMPLOYEE", "OTHER"] as const;

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? es.common.saving : es.common.save}
    </Button>
  );
}

export function CustomerForm({
  customer,
  decimalPlaces,
}: {
  customer?: CustomerDefaults;
  /** Zero where the currency has no cents, so the income field offers none. */
  decimalPlaces: number;
}) {
  // Un mismo formulario sirve para crear y para editar: la única diferencia es
  // a qué acción se envía y de dónde salen los valores iniciales.
  const editando = customer !== undefined;
  const { state, pending, onSubmit } = useFormAction<CustomerFormState>(
    editando ? updateCustomer : createCustomer,
    {},
  );
  const [employmentType, setEmploymentType] = useState<string>(
    customer?.employmentType ?? "",
  );
  const fieldError = (name: string) => state.fieldErrors?.[name];
  /** Los campos de texto no aceptan null, y en creación no hay valor previo. */
  const v = (value: string | number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);

  // The employer only makes sense for someone on a payroll.
  const isEmployee = employmentType === "EMPLOYEE";

  return (
    <form method="post" onSubmit={onSubmit} className="max-w-4xl space-y-4">
      {editando ? (
        <input type="hidden" name="customerId" value={customer.id} />
      ) : null}

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card>
        <CardHeader title={es.customers.personalSection} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex justify-center pb-2">
            <PhotoUpload
              name="photoUrl"
              label={es.customers.photo}
              hint={es.customers.photoHint}
              shape="avatar"
              required={!editando}
              defaultValue={storedPhoto(customer?.photoUrl)}
            />
          </div>
          <Field
            label={es.customers.firstName}
            htmlFor="firstName"
            required
            error={fieldError("firstName")}
          >
            <Input
              id="firstName"
              name="firstName"
              defaultValue={v(customer?.firstName)}
              required
              autoFocus
            />
          </Field>
          <Field
            label={es.customers.lastName}
            htmlFor="lastName"
            required
            error={fieldError("lastName")}
          >
            <Input
              id="lastName"
              name="lastName"
              defaultValue={v(customer?.lastName)}
              required
            />
          </Field>
          <Field label={es.customers.documentType} htmlFor="documentType">
            <Input
              id="documentType"
              name="documentType"
              defaultValue={v(customer?.documentType)}
              placeholder="Cédula"
            />
          </Field>
          <Field label={es.customers.documentNumber} htmlFor="documentNumber">
            <Input
              id="documentNumber"
              name="documentNumber"
              defaultValue={v(customer?.documentNumber)}
              inputMode="numeric"
            />
          </Field>
          <Field
            label={es.customers.birthDate}
            htmlFor="birthDate"
            hint={es.customers.birthDateHint}
            error={fieldError("birthDate")}
          >
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={v(customer?.birthDate)}
              // Nobody is born tomorrow: the picker itself says so.
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label={es.customers.gender} htmlFor="gender">
            <Select
              id="gender"
              name="gender"
              defaultValue={v(customer?.gender)}
            >
              <option value="">{es.customers.genderUnset}</option>
              {GENDERS.map((option) => (
                <option key={option} value={option}>
                  {es.customers.genderLabel[option]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={es.customers.nationality}
              htmlFor="nationality"
              hint={es.customers.nationalityHint}
            >
              <Input
                id="nationality"
                name="nationality"
                defaultValue={v(customer?.nationality)}
                list="nationality-options"
                autoComplete="off"
              />
            </Field>
            {/* A suggestion list rather than a closed one: a customer whose
                country is missing must still be registrable. */}
            <datalist id="nationality-options">
              {NATIONALITY_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
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
              defaultValue={v(customer?.mobilePhone)}
              type="tel"
              inputMode="tel"
            />
          </Field>
          <Field label={es.customers.phone} htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              defaultValue={v(customer?.phone)}
              type="tel"
              inputMode="tel"
            />
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
                defaultValue={v(customer?.email)}
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
                defaultValue={v(customer?.address)}
                placeholder="Calle y número"
              />
            </Field>
          </div>
          <Field
            label={es.customers.neighborhood}
            htmlFor="neighborhood"
            hint="Ayuda al cobrador a ubicar al cliente."
          >
            <Input
              id="neighborhood"
              name="neighborhood"
              defaultValue={v(customer?.neighborhood)}
            />
          </Field>
          <Field label={es.customers.city} htmlFor="city">
            <Input id="city" name="city" defaultValue={v(customer?.city)} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={es.customers.landmark}
              htmlFor="landmark"
              hint={es.customers.landmarkHint}
            >
              <Input
                id="landmark"
                name="landmark"
                defaultValue={v(customer?.landmark)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <LocationField
              name="home"
              label={es.customers.locationHome}
              defaultValue={storedPoint(
                customer?.latitude,
                customer?.longitude,
              )}
            />
          </div>
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
              defaultValue={v(customer?.occupation)}
              placeholder="Comerciante, chofer, estilista…"
            />
          </Field>

          {isEmployee ? (
            <div className="sm:col-span-2">
              <Field label={es.customers.employerName} htmlFor="employerName">
                <Input
                  id="employerName"
                  name="employerName"
                  defaultValue={v(customer?.employerName)}
                />
              </Field>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Field label={es.customers.workAddress} htmlFor="workAddress">
              <Input
                id="workAddress"
                name="workAddress"
                defaultValue={v(customer?.workAddress)}
              />
            </Field>
          </div>

          <Field
            label={es.customers.workNeighborhood}
            htmlFor="workNeighborhood"
          >
            <Input
              id="workNeighborhood"
              name="workNeighborhood"
              defaultValue={v(customer?.workNeighborhood)}
            />
          </Field>

          <Field label={es.customers.monthlyIncome} htmlFor="monthlyIncome">
            <Input
              id="monthlyIncome"
              name="monthlyIncome"
              defaultValue={customer?.monthlyIncome ?? ""}
              inputMode="decimal"
              type="number"
              step={decimalPlaces === 0 ? "1" : "0.01"}
              min="0"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label={es.customers.workLandmark}
              htmlFor="workLandmark"
              hint={es.customers.landmarkHint}
            >
              <Input
                id="workLandmark"
                name="workLandmark"
                defaultValue={v(customer?.workLandmark)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <LocationField
              name="work"
              label={es.customers.locationWork}
              defaultValue={storedPoint(
                customer?.workLatitude,
                customer?.workLongitude,
              )}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={es.customers.paydaySection}
          description={es.customers.paydayHint}
        />
        <CardBody>
          <PaydayFields
            defaultKind={(customer?.paydayKind ?? "") as PaydayKind | ""}
            defaultWeekday={customer?.paydayWeekday}
            defaultDayOfMonth={customer?.paydayDayOfMonth}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={es.customers.referencesSection}
          description={es.customers.referencesHint}
        />
        <CardBody>
          <ReferenceFields defaultValues={customer?.references ?? []} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={es.customers.documentsSection}
          description={es.customers.documentsHint}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <PhotoUpload
            name="idFrontUrl"
            label={es.customers.idFront}
            defaultValue={storedPhoto(customer?.idFrontUrl)}
          />
          <PhotoUpload
            name="idBackUrl"
            label={es.customers.idBack}
            defaultValue={storedPhoto(customer?.idBackUrl)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={es.common.notes} />
        <CardBody>
          <Field label={es.common.notes} htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              defaultValue={v(customer?.notes)}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton pending={pending} />
      </div>
    </form>
  );
}
