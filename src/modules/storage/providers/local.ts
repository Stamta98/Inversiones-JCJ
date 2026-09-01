/**
 * Local disk storage.
 *
 * The default, and the right choice on a VPS or a Docker host. It will not
 * survive a redeploy on a serverless platform with an ephemeral filesystem;
 * use the Supabase provider there.
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { assertSafeKey, buildKey } from "./paths";
import type { StorageProvider, StoredFile, StoredFileInput } from "./types";

export class LocalStorageProvider implements StorageProvider {
  readonly key = "local";
  private readonly root: string;

  constructor(rootDirectory: string) {
    this.root = resolve(rootDirectory);
  }

  /** Resolves a key inside the root, refusing anything that escapes it. */
  private pathFor(storageKey: string): string {
    assertSafeKey(storageKey);
    const fullPath = resolve(join(this.root, storageKey));
    if (fullPath !== this.root && !fullPath.startsWith(this.root + sep)) {
      throw new Error(`Storage key escapes the root: ${storageKey}`);
    }
    return fullPath;
  }

  async put(input: StoredFileInput): Promise<StoredFile> {
    const storageKey = buildKey(
      input.companyId,
      input.contentType,
      input.fileName,
    );
    const fullPath = this.pathFor(storageKey);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.data);

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
    try {
      const buffer = await readFile(this.pathFor(storageKey));
      return {
        data: new Uint8Array(buffer),
        contentType: contentTypeOf(storageKey),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.pathFor(storageKey)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

export function contentTypeOf(storageKey: string): string {
  const extension = storageKey.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}
