"use client";

import { Alert, Button, Field, Input } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";
import { signIn, type ActionState } from "@/server/auth/actions";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? es.auth.signingIn : es.auth.signIn}
    </Button>
  );
}

export function SignInForm() {
  const { state, pending, onSubmit } = useFormAction<ActionState>(signIn, {});

  return (
    <form
      onSubmit={onSubmit}
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

      <SubmitButton pending={pending} />
    </form>
  );
}
