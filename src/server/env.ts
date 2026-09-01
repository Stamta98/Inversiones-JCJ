/**
 * Environment configuration, validated once at startup.
 */

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_CURRENCY: z.string().default("DOP"),
  DEFAULT_TIMEZONE: z.string().default("America/Santo_Domingo"),
  WHATSAPP_PROVIDER: z.enum(["cloud_api", "bridge", "log"]).default("log"),
  WHATSAPP_CLOUD_API_TOKEN: z.string().optional(),
  WHATSAPP_CLOUD_API_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BRIDGE_URL: z.string().optional(),
  WHATSAPP_BRIDGE_TOKEN: z.string().optional(),
  JOBS_SECRET: z.string().min(8).default("development-jobs-secret"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}
