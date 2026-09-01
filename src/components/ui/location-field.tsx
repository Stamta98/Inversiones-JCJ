"use client";

import { useState } from "react";

import { es } from "@/i18n/es";

import { Icon } from "./icon";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Captures the device's coordinates into two hidden inputs.
 *
 * Meant to be used standing in front of the house: a collector taps once and
 * the exact spot is stored, which is far more reliable than a street address
 * in a neighbourhood without numbering.
 */
export function LocationField({
  name,
  label,
  defaultValue,
}: {
  /** Base field name; latitude and longitude are submitted as `${name}Latitude` and `${name}Longitude`. */
  name: string;
  label: string;
  defaultValue?: Coordinates | null;
}) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(
    defaultValue ?? null,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const capture = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError(es.customers.locationUnsupported);
      return;
    }

    setStatus("loading");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setStatus("idle");
      },
      () => {
        setStatus("error");
        setError(es.customers.locationDenied);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </span>

      <input
        type="hidden"
        name={`${name}Latitude`}
        value={coordinates?.latitude ?? ""}
      />
      <input
        type="hidden"
        name={`${name}Longitude`}
        value={coordinates?.longitude ?? ""}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={capture}
          disabled={status === "loading"}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand-strong disabled:opacity-60"
        >
          <Icon name="map-pin" size={14} />
          {status === "loading"
            ? es.customers.locationSaving
            : coordinates
              ? es.customers.recaptureLocation
              : es.customers.captureLocation}
        </button>

        {coordinates ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-brand-strong hover:underline"
          >
            {es.customers.locationSaved}
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
