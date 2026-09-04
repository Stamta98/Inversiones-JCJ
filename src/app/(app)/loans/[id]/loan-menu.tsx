"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, Icon } from "@/components/ui";
import { es } from "@/i18n/es";

/**
 * Las acciones del préstamo, detrás de los tres puntos.
 *
 * Lo primero es llamar o escribirle: en la puerta, con el cliente delante o
 * sin abrir, eso es lo que se hace. Editar y eliminar van después y separados,
 * para no borrar un préstamo queriendo marcar un número.
 */
export function LoanMenu({
  loanId,
  phone,
  message,
  canEdit,
  canDelete,
}: {
  loanId: string;
  /** Solo dígitos, listo para tel: y para wa.me. */
  phone: string | null;
  /** Lo que se manda ya escrito, para no teclearlo en la calle. */
  message: string;
  canEdit: boolean;
  canDelete: boolean;
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

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink hover:bg-surface-muted";

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
          {phone ? (
            <>
              <a className={item} href={`tel:+${phone}`}>
                <Icon name="phone" size={16} className="text-ink-subtle" />
                {es.loans.contact.call}
              </a>
              <a
                className={item}
                href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="send" size={16} className="text-positive" />
                {es.loans.contact.whatsapp}
              </a>
              <a
                className={item}
                href={`sms:+${phone}?&body=${encodeURIComponent(message)}`}
              >
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

          {canEdit || canDelete ? (
            <div className="border-t border-border">
              {canEdit ? (
                <Link className={item} href={`/loans/${loanId}/edit`}>
                  <Icon name="pencil" size={16} className="text-ink-subtle" />
                  {es.common.edit}
                </Link>
              ) : null}
              {canDelete ? (
                <Link
                  className={`${item} text-danger`}
                  href={`/loans/${loanId}/edit#eliminar`}
                >
                  <Icon name="trash" size={16} />
                  {es.loans.delete}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
