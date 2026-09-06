"use client";

import { Alert, Button, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";

import { useDeleteCustomer } from "../use-delete-customer";

/**
 * Borra un cliente para siempre.
 *
 * Se dice antes qué se lleva por delante — cuántos préstamos, cuánto debe,
 * cuánto había pagado — porque un cliente con préstamos activos no es lo mismo
 * que uno repetido creado por error, y desde un botón no se distingue.
 */
export function DeleteCustomer({
  customerId,
  loans,
  outstanding,
  paid,
  money,
}: {
  customerId: string;
  loans: number;
  outstanding: number;
  paid: number;
  /** Ya formateado: la moneda de la empresa se resuelve en el servidor. */
  money: { outstanding: string; paid: string };
}) {
  const { remove, pending } = useDeleteCustomer(customerId, {
    loans,
    outstanding,
    paid,
    money,
  });

  return (
    <CardBody className="space-y-4">
      <Alert tone="danger">
        {loans > 0
          ? `${es.customers.deleteConfirm} ${es.customers.deleteWithLoans.replace(
              "{loans}",
              String(loans),
            )}`
          : `${es.customers.deleteConfirm} ${es.customers.deleteNoLoans}`}
      </Alert>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="danger"
          icon="trash"
          onClick={remove}
          disabled={pending}
        >
          {pending ? es.common.saving : es.customers.delete}
        </Button>
      </div>
    </CardBody>
  );
}
