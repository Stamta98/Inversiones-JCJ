"use client";

import { Alert, Button, CardBody, Field, Textarea } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  cancelLoanAction,
  deleteLoanAction,
  updateLoanAction,
  type LoanFormState,
} from "../../actions";

/**
 * Notas de un préstamo que ya salió de borrador.
 *
 * Es lo único editable a esa altura: el monto, la tasa y las cuotas ya
 * generaron los cobros aplicados.
 */
export function LoanNotesForm({
  loanId,
  notes,
}: {
  loanId: string;
  notes: string | null;
}) {
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    updateLoanAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="loanId" value={loanId} />
      {/* Le dice a la acción que solo mire las notas. */}
      <input type="hidden" name="notesOnly" value="on" />
      <CardBody className="space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Field label={es.common.notes} htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={notes ?? ""} rows={4} />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? es.common.saving : es.common.save}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

export function CancelLoanForm({ loanId }: { loanId: string }) {
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    cancelLoanAction,
    {},
  );

  return (
    <form
      method="post"
      onSubmit={(event) => {
        // Anular cierra el préstamo; conviene preguntar una sola vez.
        if (!window.confirm(es.loans.cancelConfirm)) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
    >
      <input type="hidden" name="loanId" value={loanId} />
      <CardBody className="space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Alert tone="warning">{es.loans.cancelConfirm}</Alert>

        <Field label={es.loans.cancelReason} htmlFor="reason">
          <Textarea id="reason" name="reason" rows={2} />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? es.common.saving : es.loans.cancel}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

/**
 * Borra el préstamo para siempre.
 *
 * Anular es lo correcto casi siempre, así que esto va aparte y se pregunta
 * antes: devuelve la plata a la caja y no se puede deshacer.
 */
export function DeleteLoanForm({ loanId }: { loanId: string }) {
  const { state, pending, onSubmit } = useFormAction<LoanFormState>(
    deleteLoanAction,
    {},
  );

  return (
    <form
      method="post"
      onSubmit={(event) => {
        if (!window.confirm(es.loans.deleteConfirm)) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
    >
      <input type="hidden" name="loanId" value={loanId} />
      <CardBody className="space-y-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <Alert tone="danger">{es.loans.deleteConfirm}</Alert>
        <div className="flex justify-end">
          <Button type="submit" variant="danger" icon="trash" disabled={pending}>
            {pending ? es.common.saving : es.loans.delete}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}
