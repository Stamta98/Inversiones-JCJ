"use client";

import { Alert, Button } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  toggleCustomerVisibilityAction,
  type CustomerFormState,
} from "../actions";

/**
 * Ocultar un cliente, o volver a mostrarlo.
 *
 * Va con su propio botón y no dentro de los tres puntos porque de allá se
 * sale al tocar, y el motivo por el que no se pudo —que todavía debe— hay que
 * poder leerlo. Aquí el aviso se queda en la pantalla.
 */
export function HideCustomer({
  customerId,
  hidden,
}: {
  customerId: string;
  /** Si ya está oculto, el botón es el de volver a mostrarlo. */
  hidden: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction<CustomerFormState>(
    toggleCustomerVisibilityAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="customerId" value={customerId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="positive" icon="check">
          {state.success}
        </Alert>
      ) : null}

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        icon={hidden ? "users" : "x"}
        disabled={pending}
      >
        {pending
          ? es.common.saving
          : hidden
            ? es.customers.unhide
            : es.customers.hide}
      </Button>
      <p className="text-xs text-ink-muted">
        {hidden ? es.customers.hiddenHint : es.customers.hideConfirm}
      </p>
    </form>
  );
}
