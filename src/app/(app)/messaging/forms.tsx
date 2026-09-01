"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  Alert,
  Button,
  CardBody,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { PROVIDER_KEYS } from "@/modules/messaging/providers";

import {
  saveAutomationRule,
  saveMessagingAccount,
  type MessagingFormState,
} from "./actions";

const SCHEDULED_TRIGGERS = [
  "BEFORE_DUE_DATE",
  "ON_DUE_DATE",
  "AFTER_DUE_DATE",
  "ARREARS_THRESHOLD",
] as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? es.common.saving : label}
    </Button>
  );
}

export function AccountForm() {
  const [state, formAction] = useActionState<MessagingFormState, FormData>(
    saveMessagingAccount,
    {},
  );
  const [provider, setProvider] = useState<string>("log");

  return (
    <form action={formAction}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.messaging.displayName} htmlFor="displayName" required>
          <Input id="displayName" name="displayName" required />
        </Field>

        <Field label={es.messaging.provider} htmlFor="provider">
          <Select
            id="provider"
            name="provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            {PROVIDER_KEYS.map((key) => (
              <option key={key} value={key}>
                {es.messaging.providerLabel[key]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={es.messaging.phoneNumber} htmlFor="phoneNumber">
          <Input id="phoneNumber" name="phoneNumber" type="tel" />
        </Field>

        {provider === "cloud_api" ? (
          <>
            <Field label="Access token" htmlFor="accessToken">
              <Input id="accessToken" name="accessToken" type="password" />
            </Field>
            <Field label="Phone number ID" htmlFor="phoneNumberId">
              <Input id="phoneNumberId" name="phoneNumberId" />
            </Field>
          </>
        ) : null}

        {provider === "bridge" ? (
          <>
            <Field label="URL del puente" htmlFor="baseUrl">
              <Input id="baseUrl" name="baseUrl" type="url" />
            </Field>
            <Field label="Token del puente" htmlFor="token">
              <Input id="token" name="token" type="password" />
            </Field>
          </>
        ) : null}

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton label={es.messaging.newAccount} />
        </div>
      </CardBody>
    </form>
  );
}

export function RuleForm({
  templates,
}: {
  templates: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState<MessagingFormState, FormData>(
    saveAutomationRule,
    {},
  );
  const [trigger, setTrigger] = useState<string>("AFTER_DUE_DATE");
  const needsOffset = trigger !== "ON_DUE_DATE";

  return (
    <form action={formAction}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.messaging.ruleName} htmlFor="ruleName" required>
          <Input id="ruleName" name="name" required />
        </Field>

        <Field label={es.messaging.template} htmlFor="templateId" required>
          <Select id="templateId" name="templateId" required defaultValue="">
            <option value="" disabled>
              {es.common.selectOne}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={es.messaging.trigger} htmlFor="trigger">
          <Select
            id="trigger"
            name="trigger"
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
          >
            {SCHEDULED_TRIGGERS.map((key) => (
              <option key={key} value={key}>
                {es.messaging.triggerLabel[key]}
              </option>
            ))}
          </Select>
        </Field>

        {needsOffset ? (
          <Field label={es.messaging.offsetDays} htmlFor="offsetDays">
            <Input
              id="offsetDays"
              name="offsetDays"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              defaultValue="3"
            />
          </Field>
        ) : (
          <input type="hidden" name="offsetDays" value="0" />
        )}

        <Field label={es.messaging.sendAtTime} htmlFor="sendAtTime">
          <Input
            id="sendAtTime"
            name="sendAtTime"
            type="time"
            defaultValue="09:00"
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton label={es.messaging.newRule} />
        </div>
      </CardBody>
    </form>
  );
}
