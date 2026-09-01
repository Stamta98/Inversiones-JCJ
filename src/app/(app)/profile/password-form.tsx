"use client";

import { Alert, Button, CardBody, Field, Input } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import { changePasswordAction, type ProfileFormState } from "./actions";

export function PasswordForm() {
  const { state, pending, onSubmit } = useFormAction<ProfileFormState>(
    changePasswordAction,
    {},
  );

  return (
    <form onSubmit={onSubmit}>
      <CardBody className="grid max-w-xl gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="sm:col-span-2">
            <Alert tone="positive" icon="check">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Field
            label={es.profile.currentPassword}
            htmlFor="currentPassword"
            required
          >
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
        </div>

        <Field
          label={es.profile.newPassword}
          htmlFor="newPassword"
          hint={es.settings.userPasswordHint}
          required
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label={es.profile.repeatPassword}
          htmlFor="repeatPassword"
          required
        >
          <Input
            id="repeatPassword"
            name="repeatPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? es.common.saving : es.profile.changePassword}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}
