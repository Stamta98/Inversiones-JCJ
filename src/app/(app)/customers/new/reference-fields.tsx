"use client";

import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { es } from "@/i18n/es";

/** Rows shown from the start. Two references is what a lender usually asks for. */
const INITIAL_ROWS = 2;
const MAX_ROWS = 5;

/**
 * Repeatable reference rows.
 *
 * Each field is submitted as a repeated name, so the action reads them with
 * `formData.getAll(...)` and zips the columns back into rows.
 */
export function ReferenceFields() {
  const [rows, setRows] = useState(INITIAL_ROWS);

  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="grid gap-4 border-b border-border pb-4 last:border-0 last:pb-0 sm:grid-cols-2"
        >
          <Field
            label={`${es.customers.referenceName} ${index + 1}`}
            htmlFor={`referenceName-${index}`}
          >
            <Input id={`referenceName-${index}`} name="referenceName" />
          </Field>
          <Field
            label={es.customers.referenceRelationship}
            htmlFor={`referenceRelationship-${index}`}
          >
            <Input
              id={`referenceRelationship-${index}`}
              name="referenceRelationship"
              placeholder="Hermana, vecino, compadre…"
            />
          </Field>
          <Field
            label={es.customers.referencePhone}
            htmlFor={`referencePhone-${index}`}
          >
            <Input
              id={`referencePhone-${index}`}
              name="referencePhone"
              type="tel"
              inputMode="tel"
            />
          </Field>
          <Field
            label={es.customers.referenceAddress}
            htmlFor={`referenceAddress-${index}`}
          >
            <Input id={`referenceAddress-${index}`} name="referenceAddress" />
          </Field>
        </div>
      ))}

      {rows < MAX_ROWS ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => setRows((current) => current + 1)}
        >
          {es.customers.addReference}
        </Button>
      ) : null}
    </div>
  );
}
