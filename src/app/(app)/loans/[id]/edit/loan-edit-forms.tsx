"use client";

import { Alert, Button, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  deleteLoanAction,
  type LoanFormState,
} from "../../actions";

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
