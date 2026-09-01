"use client";

import { useEffect, useRef, useState } from "react";

import { es } from "@/i18n/es";
import { prepareImage } from "@/lib/image";
import { cn } from "@/lib/cn";

import { Icon } from "./icon";

export interface UploadedFile {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

type Shape = "avatar" | "card";

/**
 * Single photo field.
 *
 * Uploads as soon as a photo is picked and keeps only the resulting URL in a
 * hidden input, so the form submission stays small. On a phone `capture` opens
 * the camera directly, which is how a collector actually takes these.
 */
export function PhotoUpload({
  name,
  label,
  hint,
  shape = "card",
  required = false,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  shape?: Shape;
  required?: boolean;
  defaultValue?: UploadedFile | null;
  onChange?: (file: UploadedFile | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [file, setFile] = useState<UploadedFile | null>(defaultValue ?? null);
  const [preview, setPreview] = useState<string | null>(
    defaultValue?.url ?? null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URLs leak until revoked, and a collector may retake a photo often.
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const handleSelection = async (selected: File | undefined) => {
    if (!selected) return;

    setError(null);
    setIsUploading(true);

    try {
      const prepared = await prepareImage(selected);

      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = prepared.previewUrl;
      setPreview(prepared.previewUrl);

      const body = new FormData();
      body.append("file", prepared.file);

      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        name?: string;
        mimeType?: string;
        sizeBytes?: number;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? es.common.error);
        setPreview(null);
        setFile(null);
        onChange?.(null);
        return;
      }

      const uploaded: UploadedFile = {
        url: payload.url,
        name: payload.name ?? prepared.file.name,
        mimeType: payload.mimeType ?? prepared.file.type,
        sizeBytes: payload.sizeBytes ?? prepared.file.size,
      };
      setFile(uploaded);
      onChange?.(uploaded);
    } catch {
      setError(es.common.error);
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const clear = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreview(null);
    setFile(null);
    setError(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isAvatar = shape === "avatar";
  const frameClasses = isAvatar
    ? "size-28 rounded-full"
    : "aspect-[16/10] w-full rounded-xl";

  return (
    <div className={cn(isAvatar && "flex flex-col items-center text-center")}>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>

      {/* The submitted value is the stored URL, never the file itself. */}
      <input type="hidden" name={name} value={file?.url ?? ""} />
      <input
        type="hidden"
        name={`${name}__meta`}
        value={
          file
            ? JSON.stringify({
                name: file.name,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
              })
            : ""
        }
      />

      <div
        className={cn(
          "relative overflow-hidden border border-dashed border-border bg-surface-muted",
          frameClasses,
        )}
      >
        {preview ? (
          // A blob/API URL of unknown dimensions; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={label}
            className="size-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1 text-ink-subtle transition-colors hover:text-brand-strong"
          >
            <Icon name={isAvatar ? "users" : "camera"} size={isAvatar ? 22 : 26} />
            {!isAvatar ? (
              <span className="text-xs">{es.common.addPhoto}</span>
            ) : null}
          </button>
        )}

        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 text-xs text-ink-muted">
            {es.common.uploading}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handleSelection(event.target.files?.[0])}
      />

      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-medium text-brand-strong hover:underline"
        >
          {preview ? es.common.changePhoto : es.common.addPhoto}
        </button>
        {preview ? (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-ink-subtle hover:text-danger"
          >
            {es.common.remove}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
