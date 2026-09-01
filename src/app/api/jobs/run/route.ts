/**
 * Scheduled job endpoint.
 *
 * Call it from any scheduler (cron, Vercel Cron, a phone's alarm) with the
 * shared secret. It refreshes arrears, queues the automated collection
 * messages and dispatches whatever is waiting.
 *
 *   curl -X POST https://.../api/jobs/run -H "x-jobs-secret: ..."
 *
 * Acepta GET además de POST, y el secreto por `Authorization: Bearer`, porque
 * Vercel Cron solo hace GET y no deja mandar encabezados propios.
 */

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/server/db";
import { env } from "@/server/env";
import { refreshLoan } from "@/server/services/loans";
import {
  dispatchQueue,
  queueScheduledMessages,
} from "@/server/services/messaging";

export const dynamic = "force-dynamic";

/** Loans refreshed per run, so a large portfolio does not time out. */
const REFRESH_BATCH_SIZE = 500;

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron no deja poner encabezados propios: manda
  // `Authorization: Bearer <secreto>` y nada más.
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i);

  const provided =
    request.headers.get("x-jobs-secret") ??
    bearer?.[1] ??
    request.nextUrl.searchParams.get("secret");

  return Boolean(provided) && provided === env().JOBS_SECRET;
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runDate = new Date();
  const companies = await db.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const report = [];

  for (const company of companies) {
    const loans = await db.loan.findMany({
      where: {
        companyId: company.id,
        status: { in: ["ACTIVE", "IN_ARREARS"] },
      },
      select: { id: true },
      take: REFRESH_BATCH_SIZE,
    });

    for (const loan of loans) {
      await db.$transaction((tx) => refreshLoan(tx, loan.id, runDate));
    }

    const queued = await queueScheduledMessages(company.id, runDate);
    const dispatched = await dispatchQueue(company.id);

    report.push({
      companyId: company.id,
      company: company.name,
      loansRefreshed: loans.length,
      ...queued,
      ...dispatched,
    });
  }

  return NextResponse.json({ ranAt: runDate.toISOString(), report });
}

export const POST = run;
/** Vercel Cron solo hace GET. Mismo trabajo, mismo secreto. */
export const GET = run;
