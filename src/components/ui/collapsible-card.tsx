import type { ReactNode } from "react";

import { Card, Icon } from "./index";

/**
 * Una tarjeta que llega cerrada y se abre si uno quiere.
 *
 * Va con `details`/`summary` del navegador y no con estado de React: así se
 * abre y se cierra aunque el JavaScript todavía no haya cargado, que en un
 * celular con mala señal es la mitad del tiempo.
 */
export function CollapsibleCard({
  title,
  description,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              {title}
            </span>
            {description ? (
              <span className="mt-0.5 block text-xs text-ink-muted">
                {description}
              </span>
            ) : null}
          </span>
          <Icon
            name="chevron-down"
            size={18}
            className="shrink-0 text-ink-subtle transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border">{children}</div>
      </details>
    </Card>
  );
}
