/**
 * File upload endpoint.
 *
 * Separate from the server actions on purpose: a photo straight off a phone is
 * far larger than the body limit of a server action, and uploading it up front
 * lets the form show a preview before anything is saved.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_BYTES,
} from "@/modules/storage/providers";
import { getAuthContext } from "@/server/auth/context";
import { storage } from "@/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se recibió ningún archivo." },
      { status: 400 },
    );
  }

  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa una imagen o un PDF." },
      { status: 415 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "El archivo pesa demasiado. Máximo 8 MB." },
      { status: 413 },
    );
  }

  const stored = await storage().put({
    companyId: context.companyId,
    fileName: file.name,
    contentType: file.type,
    data: new Uint8Array(await file.arrayBuffer()),
  });

  return NextResponse.json({
    url: stored.url,
    key: stored.key,
    name: file.name,
    mimeType: stored.contentType,
    sizeBytes: stored.sizeBytes,
  });
}
