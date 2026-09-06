"use client";

import { useTransition } from "react";

import { Alert, Button, Card, CardBody } from "@/components/ui";
import { es } from "@/i18n/es";

import { shiftAllFirstDueAction } from "./actions";

/**
 * Enderezar de una vez todos los préstamos que cobran el día de la entrega.
 *
 * Sale en la lista mientras quede alguno y se va solo cuando no queda
 * ninguno: es una limpieza de una sola vez, no un botón para siempre.
 */
export function FixAllFirstDue({
  count,
  codes,
}: {
  count: number;
  /** Unos cuantos códigos, para que se vea de cuáles se está hablando. */
  codes: string[];
}) {
  const [pending, startTransition] = useTransition();

  const corregir = () => {
    if (!window.confirm(es.loans.fixAllConfirm.replace("{count}", String(count))))
      return;
    startTransition(async () => {
      await shiftAllFirstDueAction();
    });
  };

  return (
    <Card className="mb-3">
      <CardBody className="space-y-3">
        <Alert tone="warning" icon="alert-triangle">
          {es.loans.fixAllNotice.replace("{count}", String(count))}
        </Alert>
        <p className="numeric text-xs text-ink-muted">
          {codes.join(" · ")}
          {count > codes.length
            ? ` · ${es.loans.fixAllMore.replace("{rest}", String(count - codes.length))}`
            : ""}
        </p>
        <Button
          type="button"
          variant="secondary"
          icon="calendar"
          onClick={corregir}
          disabled={pending}
        >
          {pending
            ? es.common.saving
            : es.loans.fixAllAction.replace("{count}", String(count))}
        </Button>
      </CardBody>
    </Card>
  );
}
