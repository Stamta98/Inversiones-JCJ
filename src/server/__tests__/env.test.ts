import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `env()` cachea el resultado, así que cada caso necesita el módulo fresco.
 */
async function loadEnv(values: Record<string, string | undefined>) {
  process.env = { ...values } as NodeJS.ProcessEnv;
  vi.resetModules();
  const { env } = await import("../env");
  return env();
}

const original = process.env;

beforeEach(() => {
  process.env = { ...original };
});

afterEach(() => {
  process.env = original;
});

const minimum = {
  DATABASE_URL: "postgresql://localhost:5432/x",
  AUTH_SECRET: "una-clave-suficientemente-larga",
};

describe("env", () => {
  it("acepta la configuración mínima", async () => {
    const result = await loadEnv(minimum);
    expect(result.DATABASE_URL).toBe(minimum.DATABASE_URL);
    expect(result.STORAGE_PROVIDER).toBe("local");
  });

  it("trata una variable vacía como no puesta y usa el valor por defecto", async () => {
    // Es lo que crea un panel de despliegue cuando el campo se deja en blanco.
    const result = await loadEnv({
      ...minimum,
      STORAGE_PROVIDER: "",
      JOBS_SECRET: "   ",
      APP_URL: "",
      SESSION_MAX_AGE_DAYS: "",
    });

    expect(result.STORAGE_PROVIDER).toBe("local");
    expect(result.JOBS_SECRET).toBe("development-jobs-secret");
    expect(result.APP_URL).toBe("http://localhost:3000");
    expect(result.SESSION_MAX_AGE_DAYS).toBe(30);
  });

  it("sigue rechazando una configuración de verdad inválida", async () => {
    await expect(
      loadEnv({ ...minimum, AUTH_SECRET: "corta" }),
    ).rejects.toThrow(/AUTH_SECRET/);
  });

  it("respeta los valores reales", async () => {
    const result = await loadEnv({ ...minimum, STORAGE_PROVIDER: "supabase" });
    expect(result.STORAGE_PROVIDER).toBe("supabase");
  });
});
