/**
 * Central de riesgo.
 *
 * Una oficina reporta a quien le quedó debiendo, y otra oficina, antes de
 * prestarle a alguien, pregunta por la cédula y ve lo que pasó.
 *
 * Es la **única** parte del sistema que lee datos de otra empresa, y eso pide
 * cuidado, no descuido:
 *
 * - Se busca **solo por el documento exacto**. No hay listar, no hay buscar
 *   por nombre, no hay parecidos. Quien no sabe a quién busca, no encuentra a
 *   nadie.
 * - Lo que se ve es lo que hace falta para decidir: quién es, quién lo
 *   reportó, cuánto y por qué. Nada más de la otra empresa.
 * - **Toda consulta queda registrada.** La persona reportada tiene derecho a
 *   saber quién pidió su información; sin este registro no habría cómo
 *   responderle.
 */

import type { Prisma } from "@prisma/client";

import {
  CreditReportError,
  type CreditSeverity,
  isUsableDocument,
  noticeAllowsReport,
  normalizeDocument,
  reportExpiresAt,
} from "@/core/credit/report";

import { db } from "../db";

export { CreditReportError };

export interface ReportedPerson {
  documentType: string | null;
  documentNumber: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  mobilePhone: string | null;
  city: string | null;
}

export interface CreditReportRow {
  id: string;
  companyId: string;
  companyName: string;
  /** Cierto cuando el reporte lo hizo la empresa que está consultando. */
  isOwn: boolean;
  severity: CreditSeverity;
  amount: number;
  daysInArrears: number;
  reason: string | null;
  reportedAt: Date;
  expiresAt: Date;
  noticedAt: Date | null;
  loanCode: string | null;
}

export interface CreditLookupResult {
  documentNumber: string;
  /** Quién es, según el reporte más reciente que lo nombra. */
  person: ReportedPerson | null;
  reports: CreditReportRow[];
  /** Lo que suman los reportes activos: es la cifra con la que se decide. */
  totalOwed: number;
  /** Cuántas oficinas distintas lo tienen reportado. */
  companies: number;
}

/** Los reportes vivos: ni retirados, ni caducados. */
function activeWhere(documentNumber: string, now: Date): Prisma.CreditReportWhereInput {
  return {
    documentNumber,
    status: "ACTIVE",
    // Caducar por fecha se hace al leer y no con un trabajo nocturno: así un
    // reporte vencido deja de verse en el momento justo, sin depender de que
    // algo corra a tiempo.
    OR: [
      { severity: "LATE", createdAt: { gt: yearsAgo(now, 2) } },
      { severity: "DEFAULT", createdAt: { gt: yearsAgo(now, 4) } },
      { severity: "FRAUD", createdAt: { gt: yearsAgo(now, 6) } },
    ],
  };
}

function yearsAgo(now: Date, years: number): Date {
  const date = new Date(now.getTime());
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date;
}

/**
 * Consultar una cédula.
 *
 * Devuelve lo que hay de esa persona en todas las empresas, y deja constancia
 * de que se consultó. Cuando no hay nada reportado también queda constancia:
 * saber que alguien preguntó por una persona limpia también importa.
 */
export async function lookupDocument(input: {
  companyId: string;
  userId: string | null;
  document: string;
  /** En falso no se registra la consulta: para los avisos que salen solos. */
  record?: boolean;
}): Promise<CreditLookupResult> {
  const documentNumber = normalizeDocument(input.document);
  if (!isUsableDocument(documentNumber)) {
    throw new CreditReportError("A document is needed", "document");
  }

  const now = new Date();
  const found = await db.creditReport.findMany({
    where: activeWhere(documentNumber, now),
    include: {
      company: { select: { name: true } },
      loan: { select: { code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const reports: CreditReportRow[] = found.map((report) => ({
    id: report.id,
    companyId: report.companyId,
    companyName: report.company.name,
    isOwn: report.companyId === input.companyId,
    severity: report.severity as CreditSeverity,
    amount: Number(report.amount),
    daysInArrears: report.daysInArrears,
    reason: report.reason,
    reportedAt: report.createdAt,
    expiresAt: reportExpiresAt(
      report.createdAt,
      report.severity as CreditSeverity,
    ),
    noticedAt: report.noticedAt,
    loanCode: report.loan?.code ?? null,
  }));

  // Quién es: lo dice el reporte más nuevo, que es el que tiene los datos
  // menos viejos. Con foto, si alguno la trajo.
  const newest = found[0];
  const withPhoto = found.find((report) => report.photoUrl);
  const person: ReportedPerson | null = newest
    ? {
        documentType: newest.documentType,
        documentNumber: newest.documentNumber,
        firstName: newest.firstName,
        lastName: newest.lastName,
        photoUrl: withPhoto?.photoUrl ?? null,
        mobilePhone:
          found.find((report) => report.mobilePhone)?.mobilePhone ?? null,
        city: found.find((report) => report.city)?.city ?? null,
      }
    : null;

  if (input.record !== false) {
    await db.creditLookup.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        documentNumber,
        foundCount: reports.length,
      },
    });
  }

  return {
    documentNumber,
    person,
    reports,
    totalOwed: reports.reduce((total, report) => total + report.amount, 0),
    companies: new Set(reports.map((report) => report.companyId)).size,
  };
}

/**
 * Cuántos reportes vivos tiene un documento, sin dejar constancia.
 *
 * Es para el aviso que sale solo en la ficha de un cliente: nadie preguntó,
 * así que registrar una consulta sería inventarla.
 */
export async function countActiveReports(
  documentNumber: string | null | undefined,
): Promise<number> {
  if (!documentNumber) return 0;
  const clean = normalizeDocument(documentNumber);
  if (!isUsableDocument(clean)) return 0;
  return db.creditReport.count({ where: activeWhere(clean, new Date()) });
}

/**
 * Reportar a un cliente.
 *
 * Antes hay que haberle avisado y haber esperado los días de ley. El reporte
 * guarda copia de sus datos: si la ficha cambia o se borra, tiene que seguir
 * diciendo a quién señaló y con qué cara.
 */
export async function reportCustomer(input: {
  companyId: string;
  userId: string | null;
  customerId: string;
  loanId?: string | null;
  severity: CreditSeverity;
  amount: number;
  reason?: string | null;
  noticedAt: Date | null;
}): Promise<{ id: string; name: string }> {
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, companyId: input.companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentType: true,
      documentNumber: true,
      photoUrl: true,
      mobilePhone: true,
      city: true,
    },
  });
  if (!customer) throw new CreditReportError("Customer not found", "notFound");

  const documentNumber = normalizeDocument(customer.documentNumber ?? "");
  if (!isUsableDocument(documentNumber)) {
    throw new CreditReportError("A document is needed", "document");
  }

  const notice = noticeAllowsReport(input.noticedAt, new Date());
  if (!input.noticedAt) {
    throw new CreditReportError("The customer has to be told first", "noticeMissing");
  }
  if (!notice.ok) {
    throw new CreditReportError(
      "The notice period has not passed",
      "noticeTooRecent",
    );
  }
  if (!(input.amount >= 0)) {
    throw new CreditReportError("An amount is needed", "amount");
  }

  // La misma empresa no lo reporta dos veces por lo mismo: se actualiza el que
  // ya está, que si no la cifra de una oficina cuenta doble.
  const existing = await db.creditReport.findFirst({
    where: {
      companyId: input.companyId,
      documentNumber,
      status: "ACTIVE",
      ...(input.loanId ? { loanId: input.loanId } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new CreditReportError("Already reported", "alreadyReported");
  }

  // Los días de atraso los dice el préstamo, no quien llena el formulario.
  const loan = input.loanId
    ? await db.loan.findFirst({
        where: { id: input.loanId, companyId: input.companyId },
        select: { id: true, daysInArrears: true },
      })
    : null;

  const report = await db.creditReport.create({
    data: {
      companyId: input.companyId,
      customerId: customer.id,
      loanId: loan?.id ?? null,
      documentType: customer.documentType,
      documentNumber,
      firstName: customer.firstName,
      lastName: customer.lastName,
      photoUrl: customer.photoUrl,
      mobilePhone: customer.mobilePhone,
      city: customer.city,
      severity: input.severity,
      amount: input.amount,
      daysInArrears: loan?.daysInArrears ?? 0,
      reason: input.reason?.trim() || null,
      noticedAt: input.noticedAt,
      createdById: input.userId,
    },
    select: { id: true },
  });

  await db.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "credit.reported",
      entityType: "CreditReport",
      entityId: report.id,
      metadata: {
        documentNumber,
        severity: input.severity,
        amount: input.amount,
        customerId: customer.id,
        loanId: loan?.id ?? null,
      },
    },
  });

  return { id: report.id, name: `${customer.firstName} ${customer.lastName}` };
}

/**
 * Retirar un reporte.
 *
 * Se retira cuando pagó, o cuando el reporte estaba equivocado. No se borra:
 * queda el rastro de que existió y de por qué se quitó, que es lo que permite
 * responderle a la persona si vuelve a preguntar.
 *
 * Solo lo puede retirar la empresa que lo hizo. Poder quitar el reporte de
 * otro sería poder limpiarle el nombre a cualquiera.
 */
export async function withdrawReport(input: {
  companyId: string;
  userId: string | null;
  reportId: string;
  reason: string;
}): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new CreditReportError("A reason is needed", "withdrawReason");
  }

  const report = await db.creditReport.findUnique({
    where: { id: input.reportId },
    select: { id: true, companyId: true, status: true, documentNumber: true },
  });
  if (!report) throw new CreditReportError("Report not found", "notFound");
  if (report.companyId !== input.companyId) {
    throw new CreditReportError("Not yours to withdraw", "notYours");
  }
  if (report.status === "WITHDRAWN") return;

  await db.creditReport.update({
    where: { id: report.id },
    data: {
      status: "WITHDRAWN",
      withdrawnAt: new Date(),
      withdrawnReason: reason,
      withdrawnById: input.userId,
    },
  });

  await db.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "credit.withdrawn",
      entityType: "CreditReport",
      entityId: report.id,
      metadata: { documentNumber: report.documentNumber, reason },
    },
  });
}

/** Lo que esta empresa tiene reportado, para su propia pantalla. */
export async function listOwnReports(companyId: string) {
  return db.creditReport.findMany({
    where: { companyId },
    include: {
      loan: { select: { id: true, code: true } },
      customer: { select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

/**
 * Quién ha consultado a esta persona.
 *
 * Se le muestra a la empresa que la reportó: saber que otras oficinas están
 * preguntando por su deudor es justamente para lo que sirve la central.
 */
export async function listLookupsFor(documentNumber: string) {
  return db.creditLookup.findMany({
    where: { documentNumber: normalizeDocument(documentNumber) },
    include: {
      company: { select: { name: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
