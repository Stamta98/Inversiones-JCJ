/**
 * Storage provider contract.
 *
 * Photos of customers and their documents are personal data, so every stored
 * object is namespaced by company and served back through an authenticated
 * route rather than a public bucket URL.
 */

export interface StoredFileInput {
  /** Namespace, always the company id, so tenants cannot read each other. */
  companyId: string;
  /** File name as the browser reported it. Only the extension is trusted. */
  fileName: string;
  contentType: string;
  data: Uint8Array;
}

export interface StoredFile {
  /** Opaque key, e.g. "<companyId>/<uuid>.jpg". */
  key: string;
  /** Path the app serves the file from. */
  url: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageProvider {
  readonly key: string;
  put(input: StoredFileInput): Promise<StoredFile>;
  /** Returns null when the key does not exist. */
  get(key: string): Promise<{ data: Uint8Array; contentType: string } | null>;
  remove(key: string): Promise<void>;
}
