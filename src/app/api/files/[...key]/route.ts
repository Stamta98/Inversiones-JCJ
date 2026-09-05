/**
 * Authenticated file serving.
 *
 * Customer photos and identity documents are personal data, so they are never
 * public. A signed-in user only sees files belonging to their own company.
 *
 * La única excepción es la foto de alguien reportado a la central de riesgo:
 * de nada sirve que otra oficina vea el reporte si no puede ver la cara del
 * que le va a tocar la puerta. Es una excepción de una sola foto por reporte
 * —la que el reporte guardó, no todo lo del cliente—, y solo mientras el
 * reporte esté vivo.
 */

import { NextResponse } from "next/server";

import {
  InvalidKeyError,
  companyIdOfKey,
} from "@/modules/storage/providers";
import { getAuthContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { storage } from "@/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const context = await getAuthContext();
  if (!context) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { key: segments } = await params;
  const storageKey = segments.join("/");

  let ownerCompanyId: string;
  try {
    ownerCompanyId = companyIdOfKey(storageKey);
  } catch (error) {
    if (error instanceof InvalidKeyError) {
      return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }

  // A file belongs to exactly one company; nobody else may read it, salvo la
  // foto que un reporte vivo de la central puso a la vista de todos.
  if (ownerCompanyId !== context.companyId) {
    const reported = await db.creditReport.count({
      where: {
        status: "ACTIVE",
        photoUrl: { endsWith: storageKey },
        companyId: ownerCompanyId,
      },
    });
    if (reported === 0) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const file = await storage().get(storageKey);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(file.data as unknown as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      // Private: the browser may cache it, shared caches may not.
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
