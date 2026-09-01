/**
 * Diagnóstico de la instalación.
 *
 * Responde si la aplicación puede hablar con su base de datos y con el
 * almacenamiento de archivos. Existe porque un fallo de configuración en un
 * hosting solo se ve como un 500 opaco: esto dice cuál de las piezas falla y
 * por qué, sin tener que leer registros.
 *
 *   GET /api/health                  -> { ok: true | false }
 *   GET /api/health?secret=JOBS_SECRET -> el detalle completo
 *
 * El detalle va detrás del secreto porque revela qué está configurado y qué
 * no. Nunca incluye el valor de ninguna variable: solo si está puesta, y del
 * servidor de base de datos el host y el puerto, que no son secretos.
 */

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Host y puerto de una cadena de conexión, sin usuario ni contraseña. */
function describeDatabaseUrl(raw: string | undefined) {
  if (!raw || raw.trim().length === 0) return { set: false as const };

  try {
    const url = new URL(raw);
    return {
      set: true as const,
      host: url.hostname,
      port: url.port || "(por defecto)",
      database: url.pathname.replace(/^\//, "") || "(ninguna)",
      user: url.username || "(ninguno)",
      hasPassword: url.password.length > 0,
      // Un espacio o un salto de linea pegado por error rompe la conexion y
      // no se ve a simple vista en el panel del hosting.
      hasSurroundingWhitespace: raw !== raw.trim(),
    };
  } catch {
    return { set: true as const, parseable: false as const };
  }
}

export async function GET(request: NextRequest) {
  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    await db.$queryRaw`select 1`;
    databaseOk = true;
  } catch (error) {
    // El mensaje de Prisma nunca lleva la contraseña, solo la causa.
    databaseError =
      error instanceof Error ? error.message.split("\n").filter(Boolean).join(" ") : String(error);
  }

  const authorized =
    request.nextUrl.searchParams.get("secret") === process.env.JOBS_SECRET &&
    Boolean(process.env.JOBS_SECRET);

  if (!authorized) {
    return NextResponse.json(
      { ok: databaseOk },
      { status: databaseOk ? 200 : 503 },
    );
  }

  const names = [
    "DATABASE_URL",
    "DIRECT_URL",
    "AUTH_SECRET",
    "JOBS_SECRET",
    "STORAGE_PROVIDER",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "APP_URL",
  ] as const;

  const variables = Object.fromEntries(
    names.map((name) => {
      const value = process.env[name];
      return [
        name,
        value === undefined || value.trim().length === 0
          ? "sin poner"
          : `puesta (${value.trim().length} caracteres)`,
      ];
    }),
  );

  return NextResponse.json(
    {
      ok: databaseOk,
      baseDeDatos: {
        conecta: databaseOk,
        error: databaseError,
        cadena: describeDatabaseUrl(process.env.DATABASE_URL),
      },
      almacenamiento: {
        proveedor: process.env.STORAGE_PROVIDER ?? "(por defecto: local)",
        claveDeSupabasePuesta: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
        ),
      },
      variables,
      revisadoEn: new Date().toISOString(),
    },
    { status: databaseOk ? 200 : 503 },
  );
}
