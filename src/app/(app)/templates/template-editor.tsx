"use client";

import { useActionState, useRef, useState } from "react";
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
import { renderTemplate } from "@/modules/templates/render";
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_GROUP_LABELS,
  type TemplateVariableGroup,
} from "@/modules/templates/variables";

import { saveTemplate, type TemplateFormState } from "./actions";

const KINDS = [
  "WHATSAPP",
  "SMS",
  "EMAIL",
  "DOCUMENT",
  "RECEIPT",
  "CONTRACT",
] as const;

const GROUPS = Object.keys(
  TEMPLATE_VARIABLE_GROUP_LABELS,
) as TemplateVariableGroup[];

/** Sample values so the preview shows a realistic message. */
const PREVIEW_CONTEXT = TEMPLATE_VARIABLES.reduce<Record<string, unknown>>(
  (context, variable) => {
    const [group, field] = variable.key.split(".");
    const bucket = (context[group] ??= {}) as Record<string, unknown>;
    bucket[field] = variable.example;
    return context;
  },
  {},
);

export interface TemplateInput {
  id?: string;
  key: string;
  name: string;
  kind: string;
  subject: string | null;
  body: string;
  description: string | null;
  isSystem: boolean;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? es.common.saving : es.common.save}
    </Button>
  );
}

export function TemplateEditor({ template }: { template?: TemplateInput }) {
  const [state, formAction] = useActionState<TemplateFormState, FormData>(
    saveTemplate,
    {},
  );
  const [body, setBody] = useState(template?.body ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /** Inserts a placeholder at the caret instead of at the end. */
  const insertVariable = (alias: string) => {
    const token = `{{${alias}}}`;
    const field = bodyRef.current;
    if (!field) {
      setBody((current) => current + token);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      {template?.id ? (
        <input type="hidden" name="id" value={template.id} />
      ) : null}

      <div className="space-y-4 lg:col-span-2">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={es.templates.name} htmlFor="name" required>
              <Input
                id="name"
                name="name"
                required
                defaultValue={template?.name}
              />
            </Field>

            <Field
              label={es.templates.key}
              htmlFor="key"
              hint={es.moduleBuilder.entityKeyHint}
              required
            >
              <Input
                id="key"
                name="key"
                required
                pattern="[a-z0-9_]+"
                defaultValue={template?.key}
                readOnly={Boolean(template?.id)}
              />
            </Field>

            <Field label={es.templates.kind} htmlFor="kind">
              <Select
                id="kind"
                name="kind"
                defaultValue={template?.kind ?? "WHATSAPP"}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {es.templates.kindLabel[kind]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={es.templates.subject} htmlFor="subject">
              <Input
                id="subject"
                name="subject"
                defaultValue={template?.subject ?? ""}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label={es.templates.body} htmlFor="body" required>
                <Textarea
                  id="body"
                  name="body"
                  ref={bodyRef}
                  required
                  rows={8}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={es.templates.preview} />
          <CardBody>
            <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm whitespace-pre-wrap text-ink">
              {renderTemplate(body, PREVIEW_CONTEXT, { fallback: "—" }) ||
                es.common.empty}
            </p>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader
          title={es.templates.variables}
          description={es.templates.variablesHint}
        />
        <CardBody className="space-y-4">
          {GROUPS.map((group) => {
            const variables = TEMPLATE_VARIABLES.filter(
              (variable) => variable.group === group,
            );
            if (variables.length === 0) return null;

            return (
              <div key={group}>
                <p className="mb-1.5 text-xs font-medium text-ink-muted">
                  {TEMPLATE_VARIABLE_GROUP_LABELS[group]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => insertVariable(variable.alias)}
                      title={variable.label}
                      className="rounded-md border border-border px-2 py-1 text-xs text-ink-muted transition-colors hover:border-brand hover:text-brand-strong"
                    >
                      {variable.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </form>
  );
}
