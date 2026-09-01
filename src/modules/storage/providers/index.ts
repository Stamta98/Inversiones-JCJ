/**
 * Storage provider factory.
 */

import { LocalStorageProvider } from "./local";
import {
  SupabaseStorageProvider,
  type SupabaseStorageCredentials,
} from "./supabase";
import type { StorageProvider } from "./types";

export const STORAGE_PROVIDER_KEYS = ["local", "supabase"] as const;

export type StorageProviderKey = (typeof STORAGE_PROVIDER_KEYS)[number];

export interface StorageSettings {
  provider: string;
  localDirectory?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket?: string;
}

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

function requireValue(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new StorageConfigurationError(
      `Storage provider "supabase" requires ${name}`,
    );
  }
  return value;
}

export function createStorageProvider(
  settings: StorageSettings,
): StorageProvider {
  switch (settings.provider) {
    case "local":
      return new LocalStorageProvider(settings.localDirectory ?? "./storage");

    case "supabase":
      return new SupabaseStorageProvider({
        url: requireValue(settings.supabaseUrl, "SUPABASE_URL"),
        serviceRoleKey: requireValue(
          settings.supabaseServiceRoleKey,
          "SUPABASE_SERVICE_ROLE_KEY",
        ),
        bucket: settings.supabaseBucket ?? "customer-files",
      } satisfies SupabaseStorageCredentials);

    default:
      throw new StorageConfigurationError(
        `Unknown storage provider: ${settings.provider}`,
      );
  }
}

export { LocalStorageProvider, SupabaseStorageProvider };
export * from "./paths";
export type { StorageProvider, StoredFile, StoredFileInput } from "./types";
