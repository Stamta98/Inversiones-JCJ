import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  InvalidKeyError,
  LocalStorageProvider,
  StorageConfigurationError,
  assertSafeKey,
  buildKey,
  companyIdOfKey,
  createStorageProvider,
  extensionFor,
} from "../providers";

describe("buildKey", () => {
  it("namespaces every file under its company", () => {
    const key = buildKey("company1", "image/jpeg", "foto.jpg");
    expect(key.startsWith("company1/")).toBe(true);
    expect(key.endsWith(".jpg")).toBe(true);
  });

  it("never reuses a key", () => {
    const keys = new Set(
      Array.from({ length: 50 }, () =>
        buildKey("company1", "image/png", "a.png"),
      ),
    );
    expect(keys.size).toBe(50);
  });
});

describe("extensionFor", () => {
  it("trusts the content type over the file name", () => {
    expect(extensionFor("image/jpeg", "foto.exe")).toBe("jpg");
    expect(extensionFor("application/pdf", "cedula")).toBe("pdf");
  });

  it("falls back to a sane extension for an unknown type", () => {
    expect(extensionFor("application/x-weird", "archivo.dat")).toBe("dat");
    expect(extensionFor("application/x-weird", "sin-extension")).toBe("bin");
  });
});

describe("assertSafeKey", () => {
  it("accepts a well formed key", () => {
    expect(() => assertSafeKey("company1/abc-123.jpg")).not.toThrow();
  });

  it("accepts the id formats a company id actually takes", () => {
    // Regression: hyphenated ids like "seed-company" were rejected, which
    // broke every upload for that tenant.
    for (const good of [
      "seed-company/abc-123.jpg",
      "cmti6ywc0000abcdef/7a6c3429-177d-434c-9c39-cea23d8d4284.jpg",
      "company_1/foto_2.png",
      "Company1/File1.PDF",
    ]) {
      expect(() => assertSafeKey(good), good).not.toThrow();
    }
  });

  it("rejects traversal and absolute paths", () => {
    for (const bad of [
      "../secrets.env",
      "company1/../../etc/passwd",
      "/etc/passwd",
      "company1\\windows.jpg",
      "company1/sub/dir/file.jpg",
      "company1/a..b.jpg",
      "..%2Fsecrets.env",
      "company1/foto.jpg/../../escape.txt",
      "company1",
      "",
    ]) {
      expect(() => assertSafeKey(bad), bad).toThrow(InvalidKeyError);
    }
  });
});

describe("companyIdOfKey", () => {
  it("extracts the owning company", () => {
    expect(companyIdOfKey("company1/abc.jpg")).toBe("company1");
  });
});

describe("createStorageProvider", () => {
  it("builds the local provider by default", () => {
    expect(createStorageProvider({ provider: "local" }).key).toBe("local");
  });

  it("refuses supabase without credentials", () => {
    expect(() => createStorageProvider({ provider: "supabase" })).toThrow(
      StorageConfigurationError,
    );
  });

  it("rejects an unknown provider", () => {
    expect(() => createStorageProvider({ provider: "ftp" })).toThrow(
      StorageConfigurationError,
    );
  });
});

describe("LocalStorageProvider", () => {
  let root: string;
  let provider: LocalStorageProvider;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "jcj-storage-"));
    provider = new LocalStorageProvider(root);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("stores and reads a file back", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const stored = await provider.put({
      companyId: "seed-company",
      fileName: "foto.jpg",
      contentType: "image/jpeg",
      data,
    });

    expect(stored.url).toBe(`/api/files/${stored.key}`);
    expect(stored.sizeBytes).toBe(4);

    const onDisk = await readFile(join(root, stored.key));
    expect(new Uint8Array(onDisk)).toEqual(data);

    const read = await provider.get(stored.key);
    expect(read?.contentType).toBe("image/jpeg");
    expect(read?.data).toEqual(data);
  });

  it("returns null for a missing file", async () => {
    expect(await provider.get("company1/no-existe.jpg")).toBeNull();
  });

  it("refuses to read outside its root", async () => {
    await expect(provider.get("../../etc/passwd")).rejects.toThrow();
  });

  it("deletes without failing when the file is already gone", async () => {
    const stored = await provider.put({
      companyId: "company1",
      fileName: "temp.png",
      contentType: "image/png",
      data: new Uint8Array([9]),
    });
    await provider.remove(stored.key);
    await expect(provider.remove(stored.key)).resolves.toBeUndefined();
    expect(await provider.get(stored.key)).toBeNull();
  });
});
