"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { LocationField } from "@/components/ui/location-field";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { COUNTRIES, findCountry } from "@/core/locales/countries";
import { CURRENCIES, defaultDecimalsFor } from "@/core/locales/currencies";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import { saveCompany, type CompanyFormState } from "./actions";

export interface CompanyDefaults {
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  currencyCode: string;
  decimalPlaces: number;
  locale: string;
  timezone: string;
}

export function CompanyForm({
  company,
  nextHref,
}: {
  company: CompanyDefaults;
  /** Set during first-run setup: saving moves on instead of staying put. */
  nextHref?: string;
}) {
  const router = useRouter();
  const { state, pending, onSubmit } = useFormAction<CompanyFormState>(
    saveCompany,
    {},
  );

  // In the wizard the save is a step, not a destination.
  useEffect(() => {
    if (state.success && nextHref) router.push(nextHref);
  }, [state.success, nextHref, router]);

  const [country, setCountry] = useState(company.country ?? "");
  const [currencyCode, setCurrencyCode] = useState(company.currencyCode);
  const [decimals, setDecimals] = useState(String(company.decimalPlaces));
  const [locale, setLocale] = useState(company.locale);
  const [timezone, setTimezone] = useState(company.timezone);

  /**
   * Choosing the country fills in everything that follows from it. Whoever is
   * setting this up knows where their office is; they should not also have to
   * know their BCP 47 tag or their IANA timezone.
   */
  const chooseCountry = (code: string) => {
    setCountry(code);
    const match = findCountry(code);
    if (!match) return;
    setCurrencyCode(match.currencyCode);
    setDecimals(String(defaultDecimalsFor(match.currencyCode)));
    setLocale(match.locale);
    setTimezone(match.timezone);
  };

  /** Picking a currency by hand still suggests how it is normally written. */
  const chooseCurrency = (code: string) => {
    setCurrencyCode(code);
    setDecimals(String(defaultDecimalsFor(code)));
  };

  // The point of the preview: you see the decision, you do not read about it.
  const preview = useMemo(() => {
    try {
      return formatCurrency(27220.5, currencyCode, locale, Number(decimals));
    } catch {
      return "—";
    }
  }, [currencyCode, locale, decimals]);

  const stateLabel =
    findCountry(country)?.stateLabel ?? es.settings.stateGeneric;

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={es.settings.identityTitle} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex justify-center pb-2">
            <PhotoUpload
              name="logoUrl"
              label={es.settings.logo}
              hint={es.settings.logoHint}
              shape="avatar"
              defaultValue={
                company.logoUrl
                  ? {
                      url: company.logoUrl,
                      name: "logo",
                      mimeType: "image/png",
                      sizeBytes: 0,
                    }
                  : null
              }
            />
          </div>

          <Field label={es.settings.companyName} htmlFor="name" required>
            <Input id="name" name="name" defaultValue={company.name} required />
          </Field>

          <Field label={es.settings.legalName} htmlFor="legalName">
            <Input
              id="legalName"
              name="legalName"
              defaultValue={company.legalName ?? ""}
            />
          </Field>

          <Field label={es.settings.taxId} htmlFor="taxId">
            <Input id="taxId" name="taxId" defaultValue={company.taxId ?? ""} />
          </Field>

          <Field label={es.settings.companyPhone} htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={company.phone ?? ""}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={es.settings.companyEmail} htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoCapitalize="none"
                defaultValue={company.email ?? ""}
              />
            </Field>
          </div>
        </CardBody>

        <CardBody className="grid gap-4 border-t border-border sm:grid-cols-2">
          <Field label={es.settings.country} htmlFor="country">
            <Select
              id="country"
              name="country"
              value={country}
              onChange={(event) => chooseCountry(event.target.value)}
            >
              <option value="">{es.common.selectOne}</option>
              {COUNTRIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={stateLabel} htmlFor="state">
            <Input id="state" name="state" defaultValue={company.state ?? ""} />
          </Field>

          <Field label={es.settings.city} htmlFor="city">
            <Input id="city" name="city" defaultValue={company.city ?? ""} />
          </Field>

          <Field label={es.settings.timezone} htmlFor="timezone">
            <Input
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={es.settings.companyAddress} htmlFor="address">
              <Input
                id="address"
                name="address"
                defaultValue={company.address ?? ""}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <LocationField
              name="office"
              label={es.settings.location}
              defaultValue={
                company.latitude !== null && company.longitude !== null
                  ? { latitude: company.latitude, longitude: company.longitude }
                  : null
              }
            />
            <p className="mt-1 text-xs text-ink-subtle">
              {es.settings.locationHint}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={es.settings.regionTitle}
          description={es.settings.regionHint}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={es.settings.currency} htmlFor="currencyCode">
            <Select
              id="currencyCode"
              name="currencyCode"
              value={currencyCode}
              onChange={(event) => chooseCurrency(event.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.name} ({currency.code})
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={es.settings.decimals}
            htmlFor="decimalPlaces"
            hint={es.settings.decimalsHint}
          >
            <Select
              id="decimalPlaces"
              name="decimalPlaces"
              value={decimals}
              onChange={(event) => setDecimals(event.target.value)}
            >
              <option value="0">{es.settings.decimalsNone}</option>
              <option value="2">{es.settings.decimalsTwo}</option>
            </Select>
          </Field>

          <input type="hidden" name="locale" value={locale} />

          <div className="sm:col-span-2 rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-xs text-ink-muted">{es.settings.preview}</p>
            <p className="numeric mt-1 text-2xl font-semibold text-ink">
              {preview}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending
            ? es.common.saving
            : nextHref
              ? es.common.next
              : es.common.save}
        </Button>
      </div>
    </form>
  );
}
