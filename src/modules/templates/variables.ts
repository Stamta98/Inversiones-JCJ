/**
 * Template variable catalogue.
 *
 * Each variable has a canonical English key used inside the code and stored in
 * the template body, plus a Spanish alias so an operator can also type
 * {{cliente.nombre}} by hand. The picker in the UI shows the Spanish label.
 */

export type TemplateVariableGroup =
  | "company"
  | "customer"
  | "loan"
  | "installment"
  | "payment"
  | "system";

export interface TemplateVariable {
  /** Canonical token, e.g. "customer.firstName". */
  key: string;
  /** Spanish token accepted as an equivalent, e.g. "cliente.nombre". */
  alias: string;
  group: TemplateVariableGroup;
  /** i18n-free Spanish label: this list is content, not chrome. */
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Company ---------------------------------------------------------------
  {
    key: "company.name",
    alias: "empresa.nombre",
    group: "company",
    label: "Nombre de la empresa",
    example: "Inversiones JCJ",
  },
  {
    key: "company.phone",
    alias: "empresa.telefono",
    group: "company",
    label: "Teléfono de la empresa",
    example: "809-555-0100",
  },
  // Customer --------------------------------------------------------------
  {
    key: "customer.firstName",
    alias: "cliente.nombre",
    group: "customer",
    label: "Nombre del cliente",
    example: "María",
  },
  {
    key: "customer.lastName",
    alias: "cliente.apellido",
    group: "customer",
    label: "Apellido del cliente",
    example: "Pérez",
  },
  {
    key: "customer.fullName",
    alias: "cliente.nombreCompleto",
    group: "customer",
    label: "Nombre completo del cliente",
    example: "María Pérez",
  },
  {
    key: "customer.code",
    alias: "cliente.codigo",
    group: "customer",
    label: "Código del cliente",
    example: "CLI-000123",
  },
  {
    key: "customer.mobilePhone",
    alias: "cliente.celular",
    group: "customer",
    label: "Celular del cliente",
    example: "809-555-0123",
  },
  // Loan ------------------------------------------------------------------
  {
    key: "loan.code",
    alias: "prestamo.numero",
    group: "loan",
    label: "Número del préstamo",
    example: "PRE-000045",
  },
  {
    key: "loan.principal",
    alias: "prestamo.monto",
    group: "loan",
    label: "Monto prestado",
    example: "RD$ 25,000.00",
  },
  {
    key: "loan.outstanding",
    alias: "prestamo.saldo",
    group: "loan",
    label: "Saldo pendiente",
    example: "RD$ 12,400.00",
  },
  {
    key: "loan.daysInArrears",
    alias: "prestamo.diasMora",
    group: "loan",
    label: "Días de mora",
    example: "7",
  },
  {
    key: "loan.frequency",
    alias: "prestamo.frecuencia",
    group: "loan",
    label: "Frecuencia de pago",
    example: "Semanal",
  },
  // Installment -----------------------------------------------------------
  {
    key: "installment.number",
    alias: "cuota.numero",
    group: "installment",
    label: "Número de la cuota",
    example: "3",
  },
  {
    key: "installment.dueDate",
    alias: "cuota.vencimiento",
    group: "installment",
    label: "Fecha de vencimiento",
    example: "15/03/2026",
  },
  {
    key: "installment.amount",
    alias: "cuota.monto",
    group: "installment",
    label: "Monto de la cuota",
    example: "RD$ 3,500.00",
  },
  {
    key: "installment.lateFee",
    alias: "cuota.mora",
    group: "installment",
    label: "Mora acumulada de la cuota",
    example: "RD$ 350.00",
  },
  {
    key: "installment.totalDue",
    alias: "cuota.totalAPagar",
    group: "installment",
    label: "Total a pagar de la cuota (con mora)",
    example: "RD$ 3,850.00",
  },
  // Payment ---------------------------------------------------------------
  {
    key: "payment.amount",
    alias: "cobro.monto",
    group: "payment",
    label: "Monto del cobro",
    example: "RD$ 3,500.00",
  },
  {
    key: "payment.receiptNumber",
    alias: "cobro.recibo",
    group: "payment",
    label: "Número de recibo",
    example: "REC-001045",
  },
  {
    key: "payment.paidAt",
    alias: "cobro.fecha",
    group: "payment",
    label: "Fecha del cobro",
    example: "15/03/2026",
  },
  // System ----------------------------------------------------------------
  {
    key: "system.today",
    alias: "sistema.hoy",
    group: "system",
    label: "Fecha de hoy",
    example: "15/03/2026",
  },
];

/** Spanish headings for the variable picker. */
export const TEMPLATE_VARIABLE_GROUP_LABELS: Record<
  TemplateVariableGroup,
  string
> = {
  company: "Empresa",
  customer: "Cliente",
  loan: "Préstamo",
  installment: "Cuota",
  payment: "Cobro",
  system: "Sistema",
};

const ALIAS_TO_KEY = new Map(
  TEMPLATE_VARIABLES.map((variable) => [variable.alias, variable.key]),
);

const KNOWN_KEYS = new Set(TEMPLATE_VARIABLES.map((variable) => variable.key));

/** Maps a Spanish alias onto its canonical key. Unknown tokens pass through. */
export function canonicalVariableKey(token: string): string {
  return ALIAS_TO_KEY.get(token) ?? token;
}

export function isKnownVariable(token: string): boolean {
  return KNOWN_KEYS.has(canonicalVariableKey(token));
}
