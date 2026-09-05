"use client";

import { useState } from "react";

import {
  ChargesField,
  emptyCharge,
  summarizeRows,
  type ChargeRow,
} from "@/components/loans/charges-field";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { formatCurrency } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";

import { updateLoanChargesAction } from "../actions";
import type { LoanFormState } from "../actions";

/**
 * Los cargos del préstamo, y la forma de cambiarlos sin salir de la ficha.
 *
 * Se leen mucho más de lo que se corrigen, así que de entrada es una tabla y
 * el formulario aparece solo cuando alguien toca "Cambiar los cargos". Lo que
 * se guarda no es solo la lista: uno financiado se reparte entre las cuotas y
 * uno descontado mueve la caja, y eso lo rehace el servidor.
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
  charges: Array<{ id: string; name: string; amount: number; mode: string }>;
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
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<ChargeRow[]>(() =>
    charges.map((charge, index) => ({
      key: index + 1,
      name: charge.name,
      amount: String(charge.amount),
      mode: charge.mode as ChargeRow["mode"],
    })),
  );
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    updateLoanChargesAction,
    {},
  );

  const money = (value: number) =>
    formatCurrency(value, currencyCode, locale, decimalPlaces);
  const totals = summarizeRows(rows);
  const guardados = charges.reduce(
    (total, charge) => total + (charge.mode === "DEDUCTED" ? charge.amount : 0),
    0,
  );

  // Al guardar, la ficha se recarga sola con los cargos nuevos; el formulario
  // se cierra para que se vea la tabla ya cambiada.
  const [guardado, setGuardado] = useState<string | undefined>(undefined);
  if (state.success && state.success !== guardado) {
    setGuardado(state.success);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader
          title={es.loans.charges.title}
          description={
            guardados > 0
              ? `${es.loans.charges.handedOver}: ${money(principal - guardados)}`
              : undefined
          }
          action={
            canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon="pencil"
                onClick={() => setEditing(true)}
              >
                {es.common.edit}
              </Button>
            ) : undefined
          }
        />

        {state.success ? (
          <CardBody className="pb-0">
            <Alert tone="positive" icon="check">
              {state.success}
            </Alert>
          </CardBody>
        ) : null}

        {charges.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-muted">{es.loans.charges.empty2}</p>
          </CardBody>
        ) : (
          <TableWrap dense>
            <thead>
              <tr>
                <Th>{es.loans.charges.name}</Th>
                <Th>{es.loans.charges.mode}</Th>
                <Th align="right">{es.loans.charges.amount}</Th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id}>
                  <Td>{charge.name}</Td>
                  <Td>
                    {
                      es.loans.charges.modeLabel[
                        charge.mode as keyof typeof es.loans.charges.modeLabel
                      ]
                    }
                  </Td>
                  <Td align="right" numeric className="font-medium">
                    {money(charge.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={es.loans.charges.title}
        description={es.loans.charges.editHint}
      />
      <CardBody>
        <form method="post" onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="loanId" value={loanId} />

          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <ChargesField
            rows={rows}
            onChange={setRows}
            decimalPlaces={decimalPlaces}
          />

          {rows.length > 0 ? (
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {es.loans.charges.deductedTotal}
                </span>
                <span className="numeric font-medium text-ink">
                  {money(totals.deducted)}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {es.loans.charges.financedTotal}
                </span>
                <span className="numeric font-medium text-ink">
                  {money(totals.financed)}
                </span>
              </p>
              {totals.deducted > 0 ? (
                <p className="flex justify-between gap-3">
                  <span className="text-ink-muted">
                    {es.loans.charges.handedOver}
                  </span>
                  <span className="numeric font-semibold text-ink">
                    {money(Math.max(0, principal - totals.deducted))}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" icon="check" disabled={pending}>
              {pending ? es.common.saving : es.common.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setRows(
                  charges.map((charge, index) => ({
                    key: index + 1,
                    name: charge.name,
                    amount: String(charge.amount),
                    mode: charge.mode as ChargeRow["mode"],
                  })),
                );
                setEditing(false);
              }}
            >
              {es.common.cancel}
            </Button>
            {rows.length === 0 ? (
              <Button
                type="button"
                variant="ghost"
                icon="plus"
                onClick={() => setRows([emptyCharge(1)])}
              >
                {es.loans.charges.add}
              </Button>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
