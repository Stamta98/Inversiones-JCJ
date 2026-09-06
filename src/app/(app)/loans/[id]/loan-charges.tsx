"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { CHARGE_MODES, type ChargeMode } from "@/core/loans/charges";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import { updateLoanChargesAction, type LoanFormState } from "../actions";

interface Row {
  /** Solo para React: un cargo nuevo todavía no existe en la base. */
  key: number;
  name: string;
  amount: string;
  mode: ChargeMode;
}

/**
 * Los cargos del préstamo, cada uno con lo suyo.
 *
 * Cada cargo lleva su lápiz y su caneca al lado, y abajo está el botón de
 * agregar: se ve qué se puede hacer sin tener que descubrirlo. Un solo botón
 * de "editar" arriba escondía las tres cosas y no se entendía cuál tocaba.
 *
 * Lo que se guarda no es la lista sola: un cargo financiado se reparte entre
 * las cuotas y uno descontado ya movió la caja el día que se entregó la plata,
 * así que el servidor rehace el plan y mueve el dinero por la diferencia.
 */
export function LoanCharges({
  loanId,
  charges,
  principal,
  currencyCode,
  locale,
  decimalPlaces,
  canEdit,
}: {
  loanId: string;
  charges: Array<{
    id: string;
    name: string;
    amount: number;
    mode: string;
    /** Lo que ya se le cobró, para el que se cobra aparte por partes. */
    paid: number;
  }>;
  principal: number;
  /**
   * La moneda viaja como datos, no como función: una función no cruza del
   * servidor al navegador y la página entera dejaba de dibujarse.
   */
  currencyCode: string;
  locale: string;
  decimalPlaces: number;
  canEdit: boolean;
}) {
  const guardadas = (): Row[] =>
    charges.map((charge, index) => ({
      key: index + 1,
      name: charge.name,
      amount: String(charge.amount),
      mode: charge.mode as ChargeMode,
    }));

  const [rows, setRows] = useState<Row[]>(guardadas);
  // Cuál se está escribiendo, y cuál se está a punto de borrar. Solo una a la
  // vez: en el teléfono dos filas abiertas no caben ni se entienden.
  const [editando, setEditando] = useState<number | null>(null);
  const [borrando, setBorrando] = useState<number | null>(null);
  const [siguiente, setSiguiente] = useState(charges.length + 1);

  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    updateLoanChargesAction,
    {},
  );

  // Cuando el servidor manda cargos distintos — porque se acaba de guardar —
  // la lista de la pantalla se pone al día y se cierra lo que estuviera
  // abierto. Sin esto la tarjeta seguía mostrando el cargo recién borrado
  // hasta que alguien recargara la página.
  const firma = charges
    .map(
      (charge) => `${charge.id}:${charge.name}:${charge.amount}:${charge.mode}`,
    )
    .join("|");
  const [vista, setVista] = useState(firma);
  if (vista !== firma) {
    setVista(firma);
    setRows(guardadas());
    setEditando(null);
    setBorrando(null);
  }

  const money = (value: number) =>
    formatCurrency(value, currencyCode, locale, decimalPlaces);

  const actualizar = (key: number, patch: Partial<Row>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const agregar = () => {
    setRows([
      ...rows,
      { key: siguiente, name: "", amount: "", mode: "DEDUCTED" },
    ]);
    setEditando(siguiente);
    setBorrando(null);
    setSiguiente(siguiente + 1);
  };

  const cancelar = () => {
    setRows(guardadas());
    setEditando(null);
    setBorrando(null);
  };

  // Lo que se manda: todo menos la que se está borrando. Así el botón de
  // confirmar es un submit normal y no hay que esperar a que el estado cambie.
  const aEnviar = rows.filter((row) => row.key !== borrando);

  // Lo que le falta a un cargo que se cobra aparte. Se lee de lo guardado,
  // no de lo que se está escribiendo: mientras se edita, lo cobrado no cambia.
  // Por nombre, que es con lo que el servidor rescata lo cobrado al
  // reescribir la lista; la llave de la fila es de React y no existe en la base.
  const falta = (row: Row) => {
    const saved = charges.find((charge) => charge.name === row.name);
    return saved ? Math.max(0, saved.amount - saved.paid) : 0;
  };

  const descontado = charges.reduce(
    (total, charge) => total + (charge.mode === "DEDUCTED" ? charge.amount : 0),
    0,
  );

  return (
    <Card>
      <CardHeader
        title={es.loans.charges.title}
        description={
          descontado > 0
            ? `${es.loans.charges.handedOver}: ${money(principal - descontado)}`
            : undefined
        }
      />

      <form method="post" onSubmit={onSubmit}>
        <input type="hidden" name="loanId" value={loanId} />
        {/* Las filas que no se están escribiendo viajan escondidas, para que
            un guardado mande siempre la lista entera. */}
        {aEnviar
          .filter((row) => row.key !== editando)
          .map((row) => (
            <div key={`oculta-${row.key}`}>
              <input type="hidden" name="chargeName" value={row.name} />
              <input type="hidden" name="chargeAmount" value={row.amount} />
              <input type="hidden" name="chargeMode" value={row.mode} />
            </div>
          ))}

        <CardBody className="space-y-3">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.success ? (
            <Alert tone="positive" icon="check">
              {state.success}
            </Alert>
          ) : null}

          {rows.length === 0 ? (
            <p className="text-sm text-ink-muted">{es.loans.charges.empty2}</p>
          ) : null}

          {rows.map((row) =>
            row.key === editando ? (
              // El que se está escribiendo: nombre, valor y forma de cobro.
              <div
                key={row.key}
                className="space-y-3 rounded-xl border border-brand bg-brand-soft/30 p-3"
              >
                <Field
                  label={es.loans.charges.name}
                  htmlFor={`chargeName-${row.key}`}
                >
                  <Input
                    id={`chargeName-${row.key}`}
                    name="chargeName"
                    value={row.name}
                    placeholder={es.loans.charges.namePlaceholder}
                    onChange={(event) =>
                      actualizar(row.key, { name: event.target.value })
                    }
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
                    className="numeric"
                    value={row.amount}
                    onChange={(event) =>
                      actualizar(row.key, { amount: event.target.value })
                    }
                  />
                </Field>

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
                      actualizar(row.key, {
                        mode: event.target.value as ChargeMode,
                      })
                    }
                  >
                    {CHARGE_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {es.loans.charges.modeLabel[mode]}
                      </option>
                    ))}
                  </Select>
                </Field>

                <p className="text-xs text-ink-subtle">
                  {es.loans.charges.editHint}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    icon="check"
                    size="sm"
                    disabled={pending}
                  >
                    {pending ? es.common.saving : es.common.save}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={cancelar}
                  >
                    {es.common.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              // Los demás: lo que dice el cargo y, al lado, qué se puede hacer
              // con él.
              <div
                key={row.key}
                className="rounded-xl border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {es.loans.charges.modeLabel[row.mode]}
                      {/* Lo que le falta al que se cobra aparte: sin esto, un
                          cargo abonado a medias se veía igual que uno intacto
                          y había que ir a la caja a averiguarlo. */}
                      {row.mode === "PENDING" && falta(row) > 0 ? (
                        <>
                          {" · "}
                          {es.loans.charges.pendingLeft.replace(
                            "{amount}",
                            money(falta(row)),
                          )}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="numeric text-sm font-semibold text-ink">
                      {money(Number(row.amount) || 0)}
                    </span>
                    {canEdit ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon="pencil"
                          aria-label={`${es.common.edit}: ${row.name}`}
                          disabled={pending}
                          onClick={() => {
                            setEditando(row.key);
                            setBorrando(null);
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon="trash"
                          aria-label={`${es.common.delete}: ${row.name}`}
                          className="text-danger"
                          disabled={pending}
                          onClick={() => {
                            setBorrando(row.key);
                            setEditando(null);
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Borrar un cargo mueve las cuotas y la caja: se pregunta
                    antes, en la misma fila, sin sacar a nadie de la pantalla. */}
                {row.key === borrando ? (
                  <div className="mt-3 rounded-lg bg-danger-soft p-3">
                    <p className="text-xs text-ink">
                      {es.loans.charges.removeConfirm}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        variant="danger"
                        size="sm"
                        icon="trash"
                        disabled={pending}
                      >
                        {pending ? es.common.saving : es.loans.charges.remove}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => setBorrando(null)}
                      >
                        {es.common.cancel}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ),
          )}

          {canEdit && editando === null && borrando === null ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={agregar}
            >
              {es.loans.charges.add}
            </Button>
          ) : null}
        </CardBody>
      </form>
    </Card>
  );
}
