"use client";

import { useTransition } from "react";

import { Alert, Button, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";

import { shiftFirstDueAction } from "../actions";

/**
 * Correr el plan de un préstamo que cobra el día en que se entregó la plata.
 *
 * Sale solo en los préstamos que vienen de antes de la regla — los nuevos ya
 * nacen bien — y se pregunta antes, porque mover las fechas de un crédito que
 * el cliente ya está pagando cambia desde cuándo está atrasado.
 */
export function ShiftFirstDue({
  loanId,
  currentFirst,
  proposedFirst,
  currentEnd,
  proposedEnd,
}: {
  loanId: string;
  /** Las cuatro fechas ya escritas: se formatean en el servidor. */
  currentFirst: string;
  proposedFirst: string;
  currentEnd: string;
  proposedEnd: string;
}) {
  const [pending, startTransition] = useTransition();

  const correr = () => {
    const aviso = es.loans.shiftFirstDueConfirm
      .replace("{from}", currentFirst)
      .replace("{to}", proposedFirst)
      .replace("{endFrom}", currentEnd)
      .replace("{endTo}", proposedEnd);
    if (!window.confirm(aviso)) return;

    const formData = new FormData();
    formData.set("loanId", loanId);
    startTransition(async () => {
      await shiftFirstDueAction(formData);
    });
  };

  return (
    <CardBody className="space-y-3">
      <Alert tone="warning" icon="alert-triangle">
        {es.loans.shiftFirstDueNotice
          .replace("{first}", currentFirst)
          .replace("{end}", currentEnd)
          .replace("{proposedEnd}", proposedEnd)}
      </Alert>
      <Button
        type="button"
        variant="secondary"
        icon="calendar"
        onClick={correr}
        disabled={pending}
      >
        {pending
          ? es.common.saving
          : es.loans.shiftFirstDueAction.replace("{to}", proposedFirst)}
      </Button>
    </CardBody>
  );
}
