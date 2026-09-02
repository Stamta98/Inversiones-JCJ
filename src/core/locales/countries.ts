/**
 * Countries the app is meant to be used in, with the defaults that follow from
 * choosing one.
 *
 * Picking the country is the first thing a company does, and it decides three
 * things they should not have to think about: the currency, how dates and
 * amounts are written, and the timezone the collection day is measured in.
 * `stateLabel` exists because the same administrative level is called
 * something different in each country — "provincia" in the Dominican Republic,
 * "departamento" in Colombia, "estado" in Mexico — and using the wrong word
 * makes the form feel foreign.
 */

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  currencyCode: string;
  /** BCP 47 tag used for number and date formatting. */
  locale: string;
  timezone: string;
  /** What the first administrative division is called here. */
  stateLabel: string;
  /** International dialing prefix, without the plus. */
  phoneCode: string;
}

export const COUNTRIES: readonly Country[] = [
  {
    code: "AR",
    name: "Argentina",
    currencyCode: "ARS",
    locale: "es-AR",
    timezone: "America/Argentina/Buenos_Aires",
    stateLabel: "Provincia",
    phoneCode: "54",
  },
  {
    code: "BO",
    name: "Bolivia",
    currencyCode: "BOB",
    locale: "es-BO",
    timezone: "America/La_Paz",
    stateLabel: "Departamento",
    phoneCode: "591",
  },
  {
    code: "BR",
    name: "Brasil",
    currencyCode: "BRL",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    stateLabel: "Estado",
    phoneCode: "55",
  },
  {
    code: "CL",
    name: "Chile",
    currencyCode: "CLP",
    locale: "es-CL",
    timezone: "America/Santiago",
    stateLabel: "Región",
    phoneCode: "56",
  },
  {
    code: "CO",
    name: "Colombia",
    currencyCode: "COP",
    locale: "es-CO",
    timezone: "America/Bogota",
    stateLabel: "Departamento",
    phoneCode: "57",
  },
  {
    code: "CR",
    name: "Costa Rica",
    currencyCode: "CRC",
    locale: "es-CR",
    timezone: "America/Costa_Rica",
    stateLabel: "Provincia",
    phoneCode: "506",
  },
  {
    code: "DO",
    name: "República Dominicana",
    currencyCode: "DOP",
    locale: "es-DO",
    timezone: "America/Santo_Domingo",
    stateLabel: "Provincia",
    phoneCode: "1",
  },
  {
    code: "EC",
    name: "Ecuador",
    currencyCode: "USD",
    locale: "es-EC",
    timezone: "America/Guayaquil",
    stateLabel: "Provincia",
    phoneCode: "593",
  },
  {
    code: "GT",
    name: "Guatemala",
    currencyCode: "GTQ",
    locale: "es-GT",
    timezone: "America/Guatemala",
    stateLabel: "Departamento",
    phoneCode: "502",
  },
  {
    code: "HN",
    name: "Honduras",
    currencyCode: "HNL",
    locale: "es-HN",
    timezone: "America/Tegucigalpa",
    stateLabel: "Departamento",
    phoneCode: "504",
  },
  {
    code: "MX",
    name: "México",
    currencyCode: "MXN",
    locale: "es-MX",
    timezone: "America/Mexico_City",
    stateLabel: "Estado",
    phoneCode: "52",
  },
  {
    code: "NI",
    name: "Nicaragua",
    currencyCode: "NIO",
    locale: "es-NI",
    timezone: "America/Managua",
    stateLabel: "Departamento",
    phoneCode: "505",
  },
  {
    code: "PA",
    name: "Panamá",
    currencyCode: "PAB",
    locale: "es-PA",
    timezone: "America/Panama",
    stateLabel: "Provincia",
    phoneCode: "507",
  },
  {
    code: "PE",
    name: "Perú",
    currencyCode: "PEN",
    locale: "es-PE",
    timezone: "America/Lima",
    stateLabel: "Departamento",
    phoneCode: "51",
  },
  {
    code: "PY",
    name: "Paraguay",
    currencyCode: "PYG",
    locale: "es-PY",
    timezone: "America/Asuncion",
    stateLabel: "Departamento",
    phoneCode: "595",
  },
  {
    code: "SV",
    name: "El Salvador",
    currencyCode: "USD",
    locale: "es-SV",
    timezone: "America/El_Salvador",
    stateLabel: "Departamento",
    phoneCode: "503",
  },
  {
    code: "UY",
    name: "Uruguay",
    currencyCode: "UYU",
    locale: "es-UY",
    timezone: "America/Montevideo",
    stateLabel: "Departamento",
    phoneCode: "598",
  },
  {
    code: "VE",
    name: "Venezuela",
    currencyCode: "VES",
    locale: "es-VE",
    timezone: "America/Caracas",
    stateLabel: "Estado",
    phoneCode: "58",
  },
];

export function findCountry(code: string): Country | null {
  const wanted = code.trim().toUpperCase();
  return COUNTRIES.find((country) => country.code === wanted) ?? null;
}

/** What choosing a country should prefill, so nothing has to be typed twice. */
export function defaultsForCountry(
  code: string,
): Pick<
  Country,
  "currencyCode" | "locale" | "timezone" | "stateLabel" | "phoneCode"
> | null {
  const country = findCountry(code);
  if (!country) return null;
  return {
    currencyCode: country.currencyCode,
    locale: country.locale,
    timezone: country.timezone,
    stateLabel: country.stateLabel,
    phoneCode: country.phoneCode,
  };
}
