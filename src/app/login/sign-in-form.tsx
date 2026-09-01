"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui";
import { es } from "@/i18n/es";
import { signIn, type ActionState } from "@/server/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? es.auth.signingIn : es.auth.signIn}
    </Button>
  );
}

export function SignInForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(signIn, {});

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-[--radius-card] border border-border bg-surface p-5"
    >
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label={es.auth.email} htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>

      <Field label={es.auth.password} htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
