/**
 * Supabase Storage provider.
 *
 * For deployments without a persistent filesystem. Talks to the REST endpoint
 * directly, so it needs no SDK. The bucket should stay private: files are
 * still served through the app's authenticated /api/files route.
 */

import { assertSafeKey, buildKey } from "./paths";
import { contentTypeOf } from "./local";
import type { StorageProvider, StoredFile, StoredFileInput } from "./types";

export interface SupabaseStorageCredentials {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

export class SupabaseStorageProvider implements StorageProvider {
  readonly key = "supabase";
  private readonly baseUrl: string;

  constructor(private readonly credentials: SupabaseStorageCredentials) {
    this.baseUrl = credentials.url.replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.serviceRoleKey}`,
      apikey: this.credentials.serviceRoleKey,
    };
  }

  private objectUrl(storageKey: string): string {
    return `${this.baseUrl}/storage/v1/object/${this.credentials.bucket}/${storageKey}`;
  }

  async put(input: StoredFileInput): Promise<StoredFile> {
    const storageKey = buildKey(
      input.companyId,
      input.contentType,
      input.fileName,
    );

    const response = await fetch(this.objectUrl(storageKey), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": input.contentType,
        "x-upsert": "false",
      },
      body: input.data as unknown as BodyInit,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Supabase storage upload failed (${response.status}): ${detail}`,
      );
    }

    return {
      key: storageKey,
      url: `/api/files/${storageKey}`,
      sizeBytes: input.data.byteLength,
      contentType: input.contentType,
    };
  }

  async get(
    storageKey: string,
  ): Promise<{ data: Uint8Array; contentType: string } | null> {
    assertSafeKey(storageKey);

    const response = await fetch(this.objectUrl(storageKey), {
      headers: this.headers(),
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Supabase storage read failed (${response.status})`);
    }

    return {
      data: new Uint8Array(await response.arrayBuffer()),
      contentType:
        response.headers.get("content-type") ?? contentTypeOf(storageKey),
    };
  }

  async remove(storageKey: string): Promise<void> {
    assertSafeKey(storageKey);
    await fetch(this.objectUrl(storageKey), {
      method: "DELETE",
      headers: this.headers(),
    });
  }
}
