"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, Icon } from "@/components/ui";
import { es } from "@/i18n/es";

import { useDeleteLoan } from "./use-delete-loan";

/**
 * Las acciones del préstamo, detrás de los tres puntos.
 *
 * Lo primero es llamar o escribirle: en la puerta, con el cliente delante o
 * sin abrir, eso es lo que se hace. Después va prestar otra vez — al mismo
 * cliente, refinanciando o renovando —, que es lo que sigue cuando uno ya
 * está en la puerta. Editar y eliminar van de últimas y separados, para no
 * borrar un préstamo queriendo marcar un número.
 */
export function LoanMenu({
  loanId,
  customerId,
  phone,
  message,
  canCreate,
  canRenew,
  canEdit,
  canDelete,
  canReport,
}: {
  loanId: string;
  customerId: string;
  /** Solo dígitos, listo para tel: y para wa.me. */
  phone: string | null;
  /** Lo que se manda ya escrito, para no teclearlo en la calle. */
  message: string;
  canCreate: boolean;
  /** Solo si este préstamo todavía se puede trasladar a uno nuevo. */
  canRenew: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Reportar a la central de riesgo: solo con el permiso y con cédula. */
  canReport: boolean;
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
  const { remove, pending, error } = useDeleteLoan(loanId);

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

          {canCreate ? (
            <div className="border-t border-border">
              <Link
                className={item}
                href={`/loans/new?customerId=${customerId}`}
              >
                <Icon name="plus" size={16} className="text-ink-subtle" />
                {es.loans.new}
              </Link>
              {canRenew ? (
                <>
                  <Link
                    className={item}
                    href={`/loans/${loanId}/renew?kind=REFINANCE`}
                  >
                    <Icon
                      name="refresh"
                      size={16}
                      className="text-ink-subtle"
                    />
                    {es.loans.renewal.kindMenu.REFINANCE}
                  </Link>
                  <Link
                    className={item}
                    href={`/loans/${loanId}/renew?kind=RENEWAL`}
                  >
                    <Icon
                      name="hand-coins"
                      size={16}
                      className="text-ink-subtle"
                    />
                    {es.loans.renewal.kindMenu.RENEWAL}
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Reportar va solo, entre prestar otra vez y editar: no es una
              manera de cobrar, es señalar a alguien en toda la ciudad. */}
          {canReport ? (
            <div className="border-t border-border">
              <Link
                className={`${row} text-warning`}
                href={`/credit/report?customerId=${customerId}&loanId=${loanId}`}
              >
                <Icon name="alert-triangle" size={16} />
                {es.credit.reportAction}
              </Link>
            </div>
          ) : null}

          {canEdit || canDelete ? (
            <div className="border-t border-border">
              {canEdit ? (
                <Link className={item} href={`/loans/${loanId}/edit`}>
                  <Icon name="pencil" size={16} className="text-ink-subtle" />
                  {es.common.edit}
                </Link>
              ) : null}
              {canDelete ? (
                <>
                  {/* Se borra desde aquí. Antes llevaba a la pantalla de
                      editar a buscar el cuadro del final: un viaje para
                      volver a pedir lo que ya se había pedido. El aviso de
                      qué se lleva por delante sigue saliendo. */}
                  <button
                    type="button"
                    className={danger}
                    disabled={pending}
                    onClick={remove}
                  >
                    <Icon name="trash" size={16} />
                    {pending ? es.common.saving : es.loans.delete}
                  </button>
                  {/* Si no se pudo, el motivo se queda a la vista dentro del
                      menú: al cerrarlo nadie lo leería. */}
                  {error ? (
                    <p className="px-3 pb-2 text-xs text-danger">{error}</p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
