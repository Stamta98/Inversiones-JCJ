/**
 * Central de riesgo: las reglas de un reporte.
 *
 * Reportar a alguien le cierra puertas en otras oficinas, así que las reglas
 * de qué se puede reportar y por cuánto tiempo no son un detalle de pantalla:
 * viven aquí, aparte, y se prueban solas.
 *
 * Tres cosas que la ley de habeas data (Ley 1266 de 2008 en Colombia) exige y
 * que por eso están escritas en el tipo, no en un comentario suelto:
 *
 * - **Avisar antes.** No se reporta a nadie de sorpresa: primero se le avisa y
 *   se le dan días para ponerse al día. `noticeDaysRequired` es esa espera.
 * - **Caducar.** Un reporte no dura para siempre. Al pagar se retira, y aun
 *   sin pagar deja de mostrarse pasado el plazo.
 * - **Poder retirarlo.** Quien reporta tiene que poder deshacerlo, porque los
 *   errores existen y la persona tiene derecho a que se corrijan.
 */

export const CREDIT_SEVERITIES = ["LATE", "DEFAULT", "FRAUD"] as const;

export type CreditSeverity = (typeof CREDIT_SEVERITIES)[number];

/**
 * Días que hay que esperar entre avisarle al cliente y reportarlo.
 *
 * La ley colombiana pide veinte días de aviso previo. Se deja aquí y no
 * repartido por la aplicación para que cambiarlo sea una línea.
 */
export const NOTICE_DAYS_REQUIRED = 20;

/** Cuánto dura visible un reporte, según su gravedad. */
export const REPORT_YEARS: Record<CreditSeverity, number> = {
  // Un atraso que se pagó pesa poco y se olvida rápido.
  LATE: 2,
  DEFAULT: 4,
  // El fraude es otra cosa: no es no haber podido, es haber engañado.
  FRAUD: 6,
};

export class CreditReportError extends Error {
  constructor(
    message: string,
    readonly code:
      | "document"
      | "name"
      | "amount"
      | "alreadyReported"
      | "notFound"
      | "notYours"
      | "noticeMissing"
      | "noticeTooRecent"
      | "withdrawReason",
  ) {
    super(message);
    this.name = "CreditReportError";
  }
}

/**
 * El documento, dejado como se busca.
 *
 * En la calle una cédula se escribe con puntos, con espacios o con guiones, y
 * la misma persona queda escrita de tres maneras distintas. Si no se guarda
 * igual que como se busca, el reporte existe y nadie lo encuentra.
 */
export function normalizeDocument(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Un documento sirve como llave si tiene con qué distinguir a alguien. */
export function isUsableDocument(raw: string): boolean {
  const clean = normalizeDocument(raw);
  return clean.length >= 5 && clean.length <= 24;
}

/**
 * Si el aviso previo alcanza para poder reportar.
 *
 * Sin fecha de aviso no se puede: reportar de sorpresa es justo lo que la ley
 * prohíbe. Con fecha, tienen que haber pasado los días de la espera.
 */
export function noticeAllowsReport(
  noticedAt: Date | null | undefined,
  now: Date,
  daysRequired: number = NOTICE_DAYS_REQUIRED,
): { ok: boolean; daysLeft: number } {
  if (!noticedAt) return { ok: false, daysLeft: daysRequired };

  const days = Math.floor(
    (now.getTime() - noticedAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  const daysLeft = Math.max(0, daysRequired - days);
  return { ok: daysLeft === 0, daysLeft };
}

/** Cuándo deja de mostrarse un reporte hecho en esa fecha. */
export function reportExpiresAt(
  createdAt: Date,
  severity: CreditSeverity,
): Date {
  const expires = new Date(createdAt.getTime());
  expires.setUTCFullYear(expires.getUTCFullYear() + REPORT_YEARS[severity]);
  return expires;
}

/** Si ya caducó y por lo tanto no debería salir en una consulta. */
export function isExpired(
  createdAt: Date,
  severity: CreditSeverity,
  now: Date,
): boolean {
  return reportExpiresAt(createdAt, severity).getTime() <= now.getTime();
}
