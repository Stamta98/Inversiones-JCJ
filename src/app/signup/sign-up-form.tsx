"use client";

import Link from "next/link";

import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { COUNTRIES, findCountry } from "@/core/locales/countries";
import { findCurrency } from "@/core/locales/currencies";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";
import { useState } from "react";

import { signUpAction, type SignUpFormState } from "./actions";

export function SignUpForm() {
  const { state, pending, onSubmit } = useFormAction<SignUpFormState>(
    signUpAction,
    {},
  );
  const [country, setCountry] = useState("");

  // Saying what the country implies, before they commit to it.
  const chosen = findCountry(country);
  const currency = chosen ? findCurrency(chosen.currencyCode) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field
        label={es.signUp.companyName}
        htmlFor="companyName"
        hint={es.signUp.companyNameHint}
        required
      >
        <Input id="companyName" name="companyName" required autoFocus />
      </Field>

      <Field
        label={es.signUp.country}
        htmlFor="countryCode"
        hint={
          currency
            ? `${currency.name} · ${currency.symbol}`
            : es.signUp.countryHint
        }
        required
      >
        <Select
          id="countryCode"
          name="countryCode"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          required
        >
          <option value="" disabled>
            {es.common.selectOne}
          </option>
          {COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={es.signUp.ownerName} htmlFor="ownerFullName" required>
        <Input id="ownerFullName" name="ownerFullName" required />
      </Field>

      <Field
        label={es.signUp.ownerEmail}
        htmlFor="ownerEmail"
        hint={es.signUp.ownerEmailHint}
        required
      >
        <Input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          autoCapitalize="none"
          required
        />
      </Field>

      <Field
        label={es.signUp.password}
        htmlFor="password"
        hint={es.signUp.passwordHint}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label={es.signUp.passwordRepeat} htmlFor="passwordRepeat" required>
        <Input
          id="passwordRepeat"
          name="passwordRepeat"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? es.signUp.creating : es.signUp.submit}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        {es.signUp.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-strong hover:underline">
          {es.signUp.goToSignIn}
        </Link>
      </p>
    </form>
  );
}
