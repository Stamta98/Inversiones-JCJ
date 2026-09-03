"use client";

import { useTransition } from "react";

import { Alert, Button, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";

import { deleteCustomerAction } from "../../actions";

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
  const [pending, startTransition] = useTransition();

  const remove = () => {
    const lines: string[] = [es.customers.deleteConfirm];
    if (loans > 0) {
      lines.push(
        es.customers.deleteWithLoans.replace("{loans}", String(loans)),
      );
      if (outstanding > 0) {
        lines.push(
          es.customers.deleteOutstanding.replace("{amount}", money.outstanding),
        );
      }
      if (paid > 0) {
        lines.push(es.customers.deletePaid.replace("{amount}", money.paid));
      }
    }
    if (!window.confirm(lines.join("\n\n"))) return;

    const formData = new FormData();
    formData.set("customerId", customerId);
    startTransition(async () => {
      await deleteCustomerAction(formData);
    });
  };

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
