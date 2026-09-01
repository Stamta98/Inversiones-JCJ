/**
 * Process wide storage provider, built once from the environment.
 */

import {
  createStorageProvider,
  type StorageProvider,
} from "@/modules/storage/providers";

import { env } from "./env";

let cached: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (cached) return cached;

  const config = env();
  cached = createStorageProvider({
    provider: config.STORAGE_PROVIDER,
    localDirectory: config.STORAGE_LOCAL_DIR,
    supabaseUrl: config.SUPABASE_URL,
    supabaseServiceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    supabaseBucket: config.SUPABASE_STORAGE_BUCKET,
  });
  return cached;
}
