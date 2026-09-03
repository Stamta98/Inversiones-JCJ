import { Button } from "./index";

/**
 * Subir, bajar o mandar al principio una fila de una lista.
 *
 * Se manda el vecino que la persona tiene delante, no una posición: la lista
 * puede venir buscada o filtrada, y la fila de arriba en la pantalla no es
 * siempre la de arriba en la lista completa.
 *
 * Son formularios de servidor, sin JavaScript: en un celular con mala señal
 * la lista se ordena igual.
 */
export function ReorderButtons({
  id,
  previousId,
  nextId,
  action,
  labels,
}: {
  id: string;
  /** La fila que se ve justo encima, si hay alguna. */
  previousId: string | null;
  nextId: string | null;
  action: (formData: FormData) => Promise<void>;
  labels: { top: string; up: string; down: string };
}) {
  const first = previousId === null;

  return (
    <span className="flex items-center gap-0.5">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="placement" value="top" />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          icon="arrow-to-top"
          aria-label={labels.top}
          title={labels.top}
          disabled={first}
        />
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="placement" value="before" />
        <input type="hidden" name="targetId" value={previousId ?? ""} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          icon="arrow-up"
          aria-label={labels.up}
          title={labels.up}
          disabled={first}
        />
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="placement" value="after" />
        <input type="hidden" name="targetId" value={nextId ?? ""} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          icon="arrow-down"
          aria-label={labels.down}
          title={labels.down}
          disabled={nextId === null}
        />
      </form>
    </span>
  );
}
