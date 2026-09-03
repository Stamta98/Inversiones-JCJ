"use client";

import { useState } from "react";

import { Button, Field, Input, Select } from "@/components/ui";
import { CHARGE_MODES, type ChargeMode } from "@/core/loans/charges";
import { es } from "@/i18n/es";

export interface ChargeRow {
  /** Solo para React: la fila no existe todavía en la base de datos. */
  key: number;
  name: string;
  amount: string;
  mode: ChargeMode;
}

export function emptyCharge(key: number): ChargeRow {
  return { key, name: "", amount: "", mode: "DEDUCTED" };
}

/**
 * Los cargos adicionales de un préstamo, dentro del formulario.
 *
 * Cada fila viaja como tres campos con el mismo nombre — `chargeName`,
 * `chargeAmount`, `chargeMode` — que el servidor vuelve a juntar por posición.
 * Es lo que un formulario sabe mandar sin inventar nada, y significa que esto
 * funciona igual aunque el JavaScript todavía no haya cargado.
 */
export function ChargesField({
  rows,
  onChange,
  decimalPlaces,
}: {
  rows: ChargeRow[];
  onChange: (rows: ChargeRow[]) => void;
  decimalPlaces: number;
}) {
  const [nextKey, setNextKey] = useState(rows.length + 1);

  const update = (key: number, patch: Partial<ChargeRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const add = () => {
    onChange([...rows, emptyCharge(nextKey)]);
    setNextKey(nextKey + 1);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-subtle">{es.loans.charges.hint}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{es.loans.charges.empty}</p>
      ) : null}

      {rows.map((row) => (
        <div
          key={row.key}
          className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2"
        >
          <Field label={es.loans.charges.name} htmlFor={`chargeName-${row.key}`}>
            <Input
              id={`chargeName-${row.key}`}
              name="chargeName"
              value={row.name}
              placeholder={es.loans.charges.namePlaceholder}
              onChange={(event) => update(row.key, { name: event.target.value })}
            />
          </Field>

          <Field
            label={es.loans.charges.amount}
            htmlFor={`chargeAmount-${row.key}`}
          >
            <Input
              id={`chargeAmount-${row.key}`}
              name="chargeAmount"
              type="number"
              inputMode="decimal"
              step={decimalPlaces === 0 ? "1" : "0.01"}
              min="0"
              value={row.amount}
              onChange={(event) =>
                update(row.key, { amount: event.target.value })
              }
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label={es.loans.charges.mode}
              htmlFor={`chargeMode-${row.key}`}
              hint={es.loans.charges.modeHint[row.mode]}
            >
              <Select
                id={`chargeMode-${row.key}`}
                name="chargeMode"
                value={row.mode}
                onChange={(event) =>
                  update(row.key, { mode: event.target.value as ChargeMode })
                }
              >
                {CHARGE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {es.loans.charges.modeLabel[mode]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() =>
                onChange(rows.filter((other) => other.key !== row.key))
              }
            >
              {es.loans.charges.remove}
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" size="sm" variant="secondary" icon="plus" onClick={add}>
        {es.loans.charges.add}
      </Button>
    </div>
  );
}

/** Los totales que la persona necesita ver antes de guardar. */
export function summarizeRows(rows: ChargeRow[]) {
  const of = (mode: ChargeMode) =>
    rows
      .filter((row) => row.mode === mode)
      .reduce((total, row) => total + (Number(row.amount) || 0), 0);

  return { deducted: of("DEDUCTED"), financed: of("FINANCED") };
}
