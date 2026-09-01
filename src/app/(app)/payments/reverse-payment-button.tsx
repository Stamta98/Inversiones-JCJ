"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui";
import { es } from "@/i18n/es";

import { reversePaymentAction } from "./actions";

/**
 * Anula un cobro ya registrado.
 *
 * Devuelve el dinero a la caja y deja las cuotas como estaban, así que se
 * pregunta el motivo antes: queda en la auditoría.
 */
export function ReversePaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, startTransition] = useTransition();

  const reverse = () => {
    const reason = window.prompt(es.payments.reverseReason);
    // Cancelar el diálogo devuelve null; una razón vacía sí se acepta.
    if (reason === null) return;

    const formData = new FormData();
    formData.set("paymentId", paymentId);
    formData.set("reason", reason);

    startTransition(async () => {
      await reversePaymentAction(formData);
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={reverse}
      disabled={pending}
    >
      {pending ? es.common.saving : es.payments.reverse}
    </Button>
  );
}
