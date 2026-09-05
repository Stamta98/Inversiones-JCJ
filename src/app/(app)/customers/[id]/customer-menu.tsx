"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, Icon } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * Las acciones del cliente, detrás de los tres puntos.
 *
 * Arriba lo que uno hace estando con él: prestarle otra vez y corregirle un
 * dato. Después las formas de encontrarlo, que es lo que sirve cuando no
 * está. Eliminar va aparte y de último: borrar un cliente queriendo marcar
 * un número sería perder su historia entera.
 */
export function CustomerMenu({
  customerId,
  phone,
  canCreateLoan,
  canEdit,
  canDelete,
  canReport,
  hasAttachments,
}: {
  customerId: string;
  /** Solo dígitos, listo para tel:, wa.me y sms:. */
  phone: string | null;
  canCreateLoan: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Reportarlo a la central de riesgo: con permiso y con cédula. */
  canReport: boolean;
  /** Sin fotos guardadas, el renglón llevaría a un cuadro vacío. */
  hasAttachments: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Tocar fuera lo cierra, que es lo que uno espera de un menú.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  // El color va aparte: junto en la misma cadena, `text-ink` le ganaba a
  // `text-danger` y el renglón de eliminar salía del mismo color que los
  // demás, que es justo lo que no puede pasar con el que borra.
  const row =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-surface-muted";
  const item = `${row} text-ink`;
  const danger = `${row} text-danger`;

  return (
    <div ref={box} className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon="more-vertical"
        aria-label={es.common.actions}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />

      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {canCreateLoan || canEdit ? (
            <div>
              {canCreateLoan ? (
                <Link
                  className={item}
                  href={`/loans/new?customerId=${customerId}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon name="plus" size={16} className="text-brand-strong" />
                  {es.customers.newLoanForCustomer}
                </Link>
              ) : null}
              {canEdit ? (
                <Link
                  className={item}
                  href={`/customers/${customerId}/edit`}
                  onClick={() => setOpen(false)}
                >
                  <Icon name="pencil" size={16} className="text-ink-subtle" />
                  {es.customers.edit}
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-border">
            {phone ? (
              <>
                <a className={item} href={`tel:+${phone}`}>
                  <Icon name="phone" size={16} className="text-ink-subtle" />
                  {es.loans.contact.call}
                </a>
                <a
                  className={item}
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="send" size={16} className="text-positive" />
                  {es.loans.contact.whatsapp}
                </a>
                <a className={item} href={`sms:+${phone}`}>
                  <Icon
                    name="message-square"
                    size={16}
                    className="text-ink-subtle"
                  />
                  {es.loans.contact.sms}
                </a>
              </>
            ) : (
              <p className="px-3 py-2.5 text-xs text-ink-subtle">
                {es.loans.contact.noPhone}
              </p>
            )}

            {hasAttachments ? (
              <a className={item} href="#adjuntos" onClick={() => setOpen(false)}>
                <Icon name="image" size={16} className="text-ink-subtle" />
                {es.customers.seeAttachments}
              </a>
            ) : null}
          </div>

          {/* Va aparte y antes de borrar: reportar no se toca por error. */}
          {canReport ? (
            <div className="border-t border-border">
              <Link
                className={`${row} text-warning`}
                href={`/credit/report?customerId=${customerId}`}
                onClick={() => setOpen(false)}
              >
                <Icon name="alert-triangle" size={16} />
                {es.credit.reportAction}
              </Link>
            </div>
          ) : null}

          {canDelete ? (
            <div className="border-t border-border">
              <Link
                className={danger}
                href={`/customers/${customerId}/edit#eliminar`}
                onClick={() => setOpen(false)}
              >
                <Icon name="trash" size={16} />
                {es.customers.delete}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
