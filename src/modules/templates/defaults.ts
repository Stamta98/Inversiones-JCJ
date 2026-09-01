/**
 * Templates and collection automations every new company starts with.
 *
 * Shared by the Prisma seed and the SQL generator, so the two can never
 * drift apart.
 */

export interface DefaultTemplate {
  key: string;
  name: string;
  kind: "WHATSAPP" | "RECEIPT";
  body: string;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "recordatorio_previo",
    name: "Recordatorio antes del vencimiento",
    kind: "WHATSAPP",
    body:
      "Hola {{cliente.nombre}}, te recordamos que tu cuota #{{cuota.numero}} " +
      "del préstamo {{prestamo.numero}} vence el {{cuota.vencimiento}} por " +
      "{{cuota.monto}}. Gracias por tu puntualidad. {{empresa.nombre}}",
  },
  {
    key: "aviso_vencimiento",
    name: "Aviso el día del vencimiento",
    kind: "WHATSAPP",
    body:
      "Hola {{cliente.nombre}}, hoy vence tu cuota de {{cuota.monto}} del " +
      "préstamo {{prestamo.numero}}. Puedes pagar hoy mismo para evitar mora. " +
      "{{empresa.nombre}}",
  },
  {
    key: "cobranza_atraso",
    name: "Cobranza por atraso",
    kind: "WHATSAPP",
    body:
      "Hola {{cliente.nombre}}, tu cuota del préstamo {{prestamo.numero}} " +
      "venció el {{cuota.vencimiento}} y lleva {{prestamo.diasMora}} días de " +
      "atraso. El total a pagar con mora es {{cuota.totalAPagar}}. " +
      "Comunícate con nosotros. {{empresa.nombre}}",
  },
  {
    key: "gracias_pago",
    name: "Agradecimiento por el pago",
    kind: "WHATSAPP",
    body:
      "Gracias {{cliente.nombre}}, recibimos tu pago de {{cobro.monto}}. " +
      "Recibo {{cobro.recibo}}. Tu saldo actual es {{prestamo.saldo}}. " +
      "{{empresa.nombre}}",
  },
  {
    key: "recibo_cobro",
    name: "Recibo de cobro",
    kind: "RECEIPT",
    body:
      "{{empresa.nombre}}\nRECIBO {{cobro.recibo}}\nFecha: {{cobro.fecha}}\n" +
      "Cliente: {{cliente.nombreCompleto}}\nPréstamo: {{prestamo.numero}}\n" +
      "Monto recibido: {{cobro.monto}}\nSaldo pendiente: {{prestamo.saldo}}",
  },
];

export interface DefaultAutomationRule {
  name: string;
  trigger:
    | "BEFORE_DUE_DATE"
    | "ON_DUE_DATE"
    | "AFTER_DUE_DATE"
    | "ARREARS_THRESHOLD";
  offsetDays: number;
  templateKey: string;
}

export const DEFAULT_AUTOMATION_RULES: DefaultAutomationRule[] = [
  {
    name: "Recordatorio 2 días antes",
    trigger: "BEFORE_DUE_DATE",
    offsetDays: 2,
    templateKey: "recordatorio_previo",
  },
  {
    name: "Aviso el día del vencimiento",
    trigger: "ON_DUE_DATE",
    offsetDays: 0,
    templateKey: "aviso_vencimiento",
  },
  {
    name: "Cobranza a los 3 días de atraso",
    trigger: "AFTER_DUE_DATE",
    offsetDays: 3,
    templateKey: "cobranza_atraso",
  },
  {
    name: "Cobranza a los 15 días de mora",
    trigger: "ARREARS_THRESHOLD",
    offsetDays: 15,
    templateKey: "cobranza_atraso",
  },
];
