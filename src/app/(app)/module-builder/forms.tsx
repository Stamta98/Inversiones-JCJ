"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  CardBody,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";
import {
  CUSTOM_FIELD_TYPES,
  FIELD_TYPES_WITH_OPTIONS,
  inputTypeFor,
  slugifyKey,
  type CustomFieldType,
  type FieldOption,
} from "@/modules/builder/fields";

import {
  createEntity,
  createField,
  createRecord,
  type BuilderFormState,
} from "./actions";

const EXTENDABLE = ["customer", "loan", "payment"] as const;

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

export function EntityForm() {
  const { state, pending, onSubmit } = useFormAction<BuilderFormState>(createEntity, {});
  const [name, setName] = useState("");

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.moduleBuilder.entityName} htmlFor="name" required>
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label={es.moduleBuilder.entityPluralName}
          htmlFor="pluralName"
          required
        >
          <Input id="pluralName" name="pluralName" required />
        </Field>

        <Field
          label={es.moduleBuilder.entityKey}
          htmlFor="key"
          hint={es.moduleBuilder.entityKeyHint}
        >
          <Input
            id="key"
            name="key"
            placeholder={name ? slugifyKey(name) : "mi_modulo"}
            pattern="[a-z][a-z0-9_]*"
          />
        </Field>

        <Field
          label={es.moduleBuilder.extendsKey}
          htmlFor="extendsKey"
          hint={es.moduleBuilder.extendsHint}
        >
          <Select id="extendsKey" name="extendsKey" defaultValue="">
            <option value="">{es.moduleBuilder.extendsNone}</option>
            {EXTENDABLE.map((key) => (
              <option key={key} value={key}>
                {es.moduleBuilder.extendable[key]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field label={es.common.notes} htmlFor="description">
            <Input id="description" name="description" />
          </Field>
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton label={es.moduleBuilder.newEntity} pending={pending} />
        </div>
      </CardBody>
    </form>
  );
}

export function FieldForm({ entityId }: { entityId: string }) {
  const { state, pending, onSubmit } = useFormAction<BuilderFormState>(createField, {});
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [label, setLabel] = useState("");
  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(type);

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="entityId" value={entityId} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.moduleBuilder.fieldLabel} htmlFor="label" required>
          <Input
            id="label"
            name="label"
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>

        <Field label={es.moduleBuilder.fieldType} htmlFor="type">
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as CustomFieldType)}
          >
            {CUSTOM_FIELD_TYPES.map((option) => (
              <option key={option} value={option}>
                {es.moduleBuilder.fieldTypeLabel[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={es.moduleBuilder.fieldKey}
          htmlFor="fieldKey"
          hint={es.moduleBuilder.entityKeyHint}
        >
          <Input
            id="fieldKey"
            name="key"
            placeholder={label ? slugifyKey(label) : "mi_campo"}
            pattern="[a-z][a-z0-9_]*"
          />
        </Field>

        <Field label={es.moduleBuilder.helpText} htmlFor="helpText">
          <Input id="helpText" name="helpText" />
        </Field>

        {needsOptions ? (
          <div className="sm:col-span-2">
            <Field
              label={es.moduleBuilder.options}
              htmlFor="optionsText"
              hint="Una opción por línea. Puedes usar «valor|Etiqueta»."
            >
              <Textarea id="optionsText" name="optionsText" rows={4} />
            </Field>
          </div>
        ) : null}

        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isRequired"
              className="size-4 rounded border-border"
            />
            {es.moduleBuilder.isRequired}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="showInList"
              defaultChecked
              className="size-4 rounded border-border"
            />
            {es.moduleBuilder.showInList}
          </label>
          <div className="ml-auto">
            <SubmitButton label={es.moduleBuilder.newField} pending={pending} />
          </div>
        </div>
      </CardBody>
    </form>
  );
}

export interface RecordFieldInput {
  key: string;
  label: string;
  type: CustomFieldType;
  isRequired: boolean;
  helpText: string | null;
  options: FieldOption[];
}

export function RecordForm({
  entityId,
  fields,
}: {
  entityId: string;
  fields: RecordFieldInput[];
}) {
  const { state, pending, onSubmit } = useFormAction<BuilderFormState>(createRecord, {});

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="entityId" value={entityId} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        {fields.map((field) => {
          const name = `field_${field.key}`;

          if (field.type === "BOOLEAN") {
            return (
              <label
                key={field.key}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name={name}
                  className="size-4 rounded border-border"
                />
                {field.label}
              </label>
            );
          }

          if (field.type === "LONG_TEXT") {
            return (
              <div key={field.key} className="sm:col-span-2">
                <Field
                  label={field.label}
                  htmlFor={name}
                  hint={field.helpText ?? undefined}
                  required={field.isRequired}
                >
                  <Textarea id={name} name={name} required={field.isRequired} />
                </Field>
              </div>
            );
          }

          if (field.type === "SELECT") {
            return (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={name}
                hint={field.helpText ?? undefined}
                required={field.isRequired}
              >
                <Select id={name} name={name} required={field.isRequired}>
                  <option value="">{es.common.selectOne}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }

          return (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={name}
              hint={field.helpText ?? undefined}
              required={field.isRequired}
            >
              <Input
                id={name}
                name={name}
                type={inputTypeFor(field.type)}
                step={
                  field.type === "CURRENCY" || field.type === "NUMBER"
                    ? "0.01"
                    : undefined
                }
                required={field.isRequired}
              />
            </Field>
          );
        })}

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton label={es.moduleBuilder.newRecord} pending={pending} />
        </div>
      </CardBody>
    </form>
  );
}
