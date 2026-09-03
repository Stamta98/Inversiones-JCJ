/**
 * Putting a list in the order a person wants it.
 *
 * Clients and loans come out sorted by something sensible — the name, the days
 * in arrears — but the person who works the list every day knows things the
 * sort does not: who to call first, which loan is the one that matters this
 * week. This lets them push a row up and have it stay there.
 *
 * A move is expressed relative to a row the person can see, never as an index.
 * The list on screen may be searched or filtered, so the row above is not
 * necessarily the row above in the full list; saying "put this one before that
 * one" means the same thing in both, and an index would not.
 */

export interface Positioned {
  id: string;
  sortOrder: number;
}

export type Placement = "before" | "after" | "top";

/**
 * Moves one id next to another, returning the whole list in its new order.
 *
 * An unknown id, or a target that is the row itself, leaves the order alone:
 * a stale page should do nothing rather than something surprising.
 */
export function moveRelativeTo(
  ids: readonly string[],
  movingId: string,
  targetId: string | null,
  placement: Placement,
): string[] {
  if (!ids.includes(movingId)) return [...ids];

  const rest = ids.filter((id) => id !== movingId);

  if (placement === "top") return [movingId, ...rest];

  if (targetId === null || targetId === movingId) return [...ids];

  const target = rest.indexOf(targetId);
  if (target === -1) return [...ids];

  const at = placement === "before" ? target : target + 1;
  return [...rest.slice(0, at), movingId, ...rest.slice(at)];
}

/**
 * The rows whose stored position no longer matches where they now sit.
 *
 * Everything starts at zero, so the first move renumbers the whole list once
 * and later ones touch only the rows between the old and the new spot.
 */
export function changedPositions(
  order: readonly string[],
  current: ReadonlyMap<string, number>,
): Positioned[] {
  const changed: Positioned[] = [];

  order.forEach((id, index) => {
    if (current.get(id) !== index) changed.push({ id, sortOrder: index });
  });

  return changed;
}

/** Whether anyone has ever reordered this list by hand. */
export function isManuallyOrdered(
  rows: readonly { sortOrder: number }[],
): boolean {
  return rows.some((row) => row.sortOrder !== 0);
}
