"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui";
import { es } from "@/i18n/es";

import { deletePaymentAction } from "./actions";

/**
 * Borra un abono.
 *
 * Se pregunta antes: devuelve el dinero a la caja y deja las cuotas como
 * estaban, y en la auditoría queda qué se borró.
 */
export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!window.confirm(es.payments.deleteConfirm)) return;

    const formData = new FormData();
    formData.set("paymentId", paymentId);
    startTransition(async () => {
      await deletePaymentAction(formData);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon="trash"
      aria-label={es.common.delete}
      title={es.common.delete}
      onClick={remove}
      disabled={pending}
    />
  );
}
