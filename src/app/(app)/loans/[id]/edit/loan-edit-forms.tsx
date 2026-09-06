"use client";

import { Alert, Button, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";

import { useDeleteLoan } from "../use-delete-loan";

export function DeleteLoanForm({ loanId }: { loanId: string }) {
  const { remove, pending, error } = useDeleteLoan(loanId);

  return (
    <CardBody className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Alert tone="danger">{es.loans.deleteConfirm}</Alert>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="danger"
          icon="trash"
          onClick={remove}
          disabled={pending}
        >
          {pending ? es.common.saving : es.loans.delete}
        </Button>
      </div>
    </CardBody>
  );
}
