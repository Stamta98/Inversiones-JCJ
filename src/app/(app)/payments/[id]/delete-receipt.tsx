"use client";

import { Button } from "@/components/ui";
import { es } from "@/i18n/es";

import { deletePaymentAction } from "../actions";

/**
 * Deletes a receipt outright.
 *
 * Kept apart from anular and worded plainly: anular leaves the record where
 * anyone can see what happened, and that is what almost every case wants.
 */
export function DeleteReceipt({ paymentId }: { paymentId: string }) {
  return (
    <form
      action={deletePaymentAction}
      onSubmit={(event) => {
        if (!window.confirm(es.payments.deleteConfirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="paymentId" value={paymentId} />
      <Button type="submit" variant="ghost" icon="trash" size="sm">
        {es.payments.delete}
      </Button>
    </form>
  );
}
