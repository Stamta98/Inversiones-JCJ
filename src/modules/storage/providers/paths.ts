/**
 * Key construction and validation.
 *
 * A storage key is "<companyId>/<random>.<ext>". Everything that touches the
 * filesystem goes through `assertSafeKey` first, so a crafted key can never
 * escape the storage root or reach another company's folder.
 */

import { randomUUID } from "node:crypto";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export const ALLOWED_CONTENT_TYPES = Object.keys(EXTENSION_BY_TYPE);

/** 8 MB. A phone photo downscaled in the browser lands far below this. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

// Company ids and file names may contain hyphens and underscores; no dots,
// which is what keeps ".." out of either segment.
const KEY_PATTERN = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

export function extensionFor(contentType: string, fileName: string): string {
  const known = EXTENSION_BY_TYPE[contentType];
  if (known) return known;

  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : "bin";
}

export function buildKey(
  companyId: string,
  contentType: string,
  fileName: string,
): string {
  return `${companyId}/${randomUUID()}.${extensionFor(contentType, fileName)}`;
}

export class InvalidKeyError extends Error {
  constructor(readonly key: string) {
    super(`Invalid storage key: ${key}`);
    this.name = "InvalidKeyError";
  }
}

/**
 * Rejects anything that is not exactly "<segment>/<segment>.<ext>". This is
 * what stops "../" traversal and absolute paths.
 */
export function assertSafeKey(key: string): void {
  if (
    !KEY_PATTERN.test(key) ||
    key.includes("..") ||
    key.startsWith("/") ||
    key.includes("\\")
  ) {
    throw new InvalidKeyError(key);
  }
}

/** The company a key belongs to, used to authorize reads. */
export function companyIdOfKey(key: string): string {
  assertSafeKey(key);
  return key.split("/")[0];
}
