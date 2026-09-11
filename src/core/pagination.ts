/**
 * Cutting a long list into pages.
 *
 * Every list here asks the database for a fixed number of rows. Without a way
 * to ask for the next ones, row fifty-one does not exist for whoever is
 * looking at the screen — and nothing on the screen says so. That is worse
 * than a slow list: the customer is there, the total counts them, and they
 * cannot be reached.
 *
 * The arithmetic lives apart from the control that draws it so it can be
 * tested on its own: an off-by-one here hides a row, which is exactly the
 * thing this is here to stop.
 */

/**
 * How many rows a list page holds.
 *
 * Fifty because that is comfortably past what this business has today: the
 * lists stay whole, with no page to turn, and the day one of them grows past
 * fifty the pager appears by itself instead of quietly dropping the rest.
 */
export const PAGE_SIZE = 50;

/**
 * The page asked for in the address, as a number that can be used.
 *
 * Anything that is not a page —a word, a zero, a half— is page one. A number
 * past the end is left alone on purpose: the count that would clamp it is not
 * known yet when the address is read, and `pageRange` settles it later.
 */
export function pageFrom(value: string | undefined): number {
  // Digits only, so "2e3" is page one and not page two thousand: the address
  // should say what it looks like it says.
  if (value === undefined || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page > 1 ? page : 1;
}

/** How many rows to skip to reach that page. */
export function skipFor(page: number, pageSize: number = PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

export interface PageRange {
  /** How many pages the total makes. Always at least one, even with nothing. */
  pages: number;
  /** The page actually being shown, once a number past the end is brought back. */
  current: number;
  /** The first and last row of this page, counting from one. */
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function pageRange(
  page: number,
  total: number,
  pageSize: number = PAGE_SIZE,
): PageRange {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : skipFor(current, pageSize) + 1;
  const to = Math.min(current * pageSize, total);

  return {
    pages,
    current,
    from,
    to,
    hasPrevious: current > 1,
    hasNext: current < pages,
  };
}
