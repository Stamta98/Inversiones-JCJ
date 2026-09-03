"use client";

import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactElement,
} from "react";

import { cn } from "@/lib/cn";

/**
 * Filas que se arrastran para ponerlas en el orden que uno quiere.
 *
 * Con el dedo y con el mouse por igual: van por eventos de puntero, que el
 * navegador manda iguales para los dos. La diferencia está en cómo se agarra
 * una fila, porque en un celular arrastrar hacia abajo ya significa algo —
 * mover la pantalla:
 *
 * - Con el dedo hay que mantener pulsada la fila un momento. Si se mueve antes
 *   de eso, es que la persona quería desplazar la lista y se deja en paz.
 * - Con el mouse basta con apretar y mover; un clic sin moverse sigue siendo
 *   un clic, así que el enlace de la fila funciona igual.
 *
 * Las filas llegan ya armadas desde el servidor. Aquí solo se cambian de sitio
 * y, al soltar, se le dice al servidor junto a cuál quedó: nunca una posición,
 * porque la lista puede venir filtrada y la fila de arriba en la pantalla no
 * es siempre la de arriba en la lista completa.
 */

/** Cuánto hay que mantener pulsado con el dedo antes de levantar la fila. */
const HOLD_MS = 300;
/** Lo que se puede mover el dedo sin que deje de contar como mantener pulsado. */
const HOLD_SLOP = 12;
/** Lo que hay que arrastrar con el mouse para que sea un arrastre y no un clic. */
const MOUSE_SLOP = 6;
/** Franja del borde de la pantalla donde la lista se desplaza sola. */
const EDGE = 72;

interface Gesture {
  pointerId: number;
  id: string;
  startY: number;
  started: boolean;
  touch: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function SortableRows({
  ids,
  children,
  action,
  enabled = true,
}: {
  /** Las filas, en el orden en que las mandó el servidor. */
  ids: string[];
  children: ReactElement<{ className?: string }>[];
  action: (formData: FormData) => Promise<void>;
  enabled?: boolean;
}) {
  const signature = ids.join("|");
  const [order, setOrder] = useState(ids);
  const [rendered, setRendered] = useState(signature);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // El servidor mandó otro orden (se movió algo, se buscó, se filtró): ese
  // manda, y lo que quedara a medias aquí se descarta.
  if (rendered !== signature) {
    setRendered(signature);
    setOrder(ids);
    setDragging(null);
  }

  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  // Un clic que salió de un arrastre no debe abrir la ficha del cliente.
  const dragEndedAt = useRef(0);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !enabled) return;

    const rowsOf = () => [...body.children] as HTMLElement[];

    const idAt = (element: EventTarget | null): string | null => {
      const row = (element as HTMLElement | null)?.closest?.("tr");
      return row?.getAttribute("data-sortable-id") ?? null;
    };

    const cancel = () => {
      const current = gesture.current;
      if (current?.timer) clearTimeout(current.timer);
      gesture.current = null;
      stopScrolling();
      setDragging(null);
    };

    // --- Desplazar la lista sola cerca de los bordes -----------------------
    let scrollFrame: number | null = null;
    let scrollSpeed = 0;

    const stopScrolling = () => {
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
      scrollSpeed = 0;
    };

    const step = () => {
      if (scrollSpeed === 0) {
        scrollFrame = null;
        return;
      }
      window.scrollBy(0, scrollSpeed);
      scrollFrame = requestAnimationFrame(step);
    };

    const scrollNear = (clientY: number) => {
      const height = window.innerHeight;
      scrollSpeed =
        clientY < EDGE ? -10 : clientY > height - EDGE ? 10 : 0;
      if (scrollSpeed !== 0 && scrollFrame === null) {
        scrollFrame = requestAnimationFrame(step);
      }
      if (scrollSpeed === 0) stopScrolling();
    };

    // --- El arrastre ------------------------------------------------------
    const pickUp = () => {
      const current = gesture.current;
      if (!current) return;
      current.started = true;
      setDragging(current.id);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const id = idAt(event.target);
      if (id === null) return;

      const touch = event.pointerType !== "mouse";
      gesture.current = {
        pointerId: event.pointerId,
        id,
        startY: event.clientY,
        started: false,
        touch,
        timer: touch ? setTimeout(pickUp, HOLD_MS) : null,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;

      if (!current.started) {
        const moved = Math.abs(event.clientY - current.startY);
        if (current.touch) {
          // Se movió antes de tiempo: quería desplazar la lista, no mover la
          // fila.
          if (moved > HOLD_SLOP) cancel();
        } else if (moved > MOUSE_SLOP) {
          pickUp();
        }
        return;
      }

      scrollNear(event.clientY);

      const rows = rowsOf();
      const from = orderRef.current.indexOf(current.id);
      const over = rows.findIndex((row) => {
        const rect = row.getBoundingClientRect();
        return event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      if (over === -1 || over === from) return;

      const next = [...orderRef.current];
      next.splice(over, 0, ...next.splice(from, 1));
      orderRef.current = next;
      setOrder(next);
    };

    const onPointerUp = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const dropped = current.started ? current.id : null;
      cancel();
      if (dropped === null) return;

      dragEndedAt.current = Date.now();

      const next = orderRef.current;
      const index = next.indexOf(dropped);
      if (index === -1 || next.length < 2) return;

      const formData = new FormData();
      formData.set("id", dropped);
      // Arriba del todo se dice "antes de la que era primera", no "al
      // principio": con la lista filtrada no son lo mismo.
      formData.set("placement", index === 0 ? "before" : "after");
      formData.set("targetId", index === 0 ? next[1]! : next[index - 1]!);

      startTransition(async () => {
        await action(formData);
      });
    };

    // Un enlace se arrastra solo en los navegadores de escritorio; aquí
    // estorba.
    const onDragStart = (event: Event) => event.preventDefault();

    // El navegador no deja frenar un desplazamiento ya empezado, así que se
    // frena aquí mientras haya una fila levantada.
    const onTouchMove = (event: TouchEvent) => {
      if (gesture.current?.started) event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      if (Date.now() - dragEndedAt.current > 250) return;
      event.preventDefault();
      event.stopPropagation();
    };

    body.addEventListener("pointerdown", onPointerDown);
    body.addEventListener("dragstart", onDragStart);
    body.addEventListener("touchmove", onTouchMove, { passive: false });
    body.addEventListener("click", onClick, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cancel);

    return () => {
      cancel();
      body.removeEventListener("pointerdown", onPointerDown);
      body.removeEventListener("dragstart", onDragStart);
      body.removeEventListener("touchmove", onTouchMove);
      body.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [action, enabled]);

  const byId = new Map(ids.map((id, index) => [id, children[index]!]));

  return (
    <tbody
      ref={bodyRef}
      className={cn(dragging !== null && "select-none")}
    >
      {order.map((id) => {
        const child = byId.get(id);
        if (!child) return null;
        return cloneElement(child, {
          "data-sortable-id": id,
          className: cn(
            child.props.className,
            enabled && "cursor-grab touch-pan-y",
            dragging === id && "cursor-grabbing bg-surface-muted opacity-95",
          ),
        } as Partial<{ className: string }>);
      })}
    </tbody>
  );
}
