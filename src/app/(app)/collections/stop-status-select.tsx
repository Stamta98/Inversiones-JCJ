"use client";

import { Select } from "@/components/ui";
import { es } from "@/i18n/es";

import { updateStopStatus } from "./actions";

const STOP_STATUSES = [
  "PENDING",
  "VISITED",
  "COLLECTED",
  "NOT_FOUND",
  "PROMISED",
  "REFUSED",
] as const;

/**
 * Submitting on change keeps a collector's one-handed phone workflow to a
 * single tap, instead of pick-then-press-save.
 */
export function StopStatusSelect({
  stopId,
  status,
}: {
  stopId: string;
  status: string;
}) {
  return (
    <form action={updateStopStatus}>
      <input type="hidden" name="stopId" value={stopId} />
      <Select
        name="status"
        defaultValue={status}
        aria-label={es.common.status}
        className="h-8 py-0 text-xs"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {STOP_STATUSES.map((option) => (
          <option key={option} value={option}>
            {es.collections.stopStatus[option]}
          </option>
        ))}
      </Select>
    </form>
  );
}
