import { describe, expect, it } from "vitest";

import { PAGE_SIZE, pageFrom, pageRange, skipFor } from "../pagination";

describe("pageFrom", () => {
  it("takes the page written in the address", () => {
    expect(pageFrom("2")).toBe(2);
    expect(pageFrom("17")).toBe(17);
  });

  it("falls back to the first page for anything that is not one", () => {
    for (const value of [undefined, "", "abc", "0", "-3", "1.5", "2e3", " "]) {
      expect(pageFrom(value)).toBe(1);
    }
  });

  it("leaves a page past the end alone: the count is not known yet here", () => {
    expect(pageFrom("999")).toBe(999);
  });
});

describe("skipFor", () => {
  it("skips nothing on the first page", () => {
    expect(skipFor(1)).toBe(0);
  });

  it("skips a whole page for every page before this one", () => {
    expect(skipFor(2)).toBe(PAGE_SIZE);
    expect(skipFor(3, 25)).toBe(50);
  });
});

describe("pageRange", () => {
  it("says nothing when everything fits: one page, no way forward", () => {
    const range = pageRange(1, 41, 50);
    expect(range).toMatchObject({
      pages: 1,
      current: 1,
      from: 1,
      to: 41,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it("counts the rows of the last page, not a full page", () => {
    // Sixty-three customers, fifty to a page: the second page has thirteen.
    expect(pageRange(2, 63, 50)).toMatchObject({
      pages: 2,
      current: 2,
      from: 51,
      to: 63,
      hasPrevious: true,
      hasNext: false,
    });
  });

  it("covers every row across the pages, with none counted twice", () => {
    const total = 137;
    const size = 25;
    const seen: number[] = [];
    for (let page = 1; page <= pageRange(1, total, size).pages; page++) {
      const { from, to } = pageRange(page, total, size);
      for (let row = from; row <= to; row++) seen.push(row);
    }
    expect(seen).toEqual(Array.from({ length: total }, (_, i) => i + 1));
  });

  it("brings a made-up page back to the last one, so there is a way back", () => {
    expect(pageRange(99, 63, 50)).toMatchObject({
      current: 2,
      from: 51,
      to: 63,
      hasPrevious: true,
      hasNext: false,
    });
  });

  it("an exact multiple does not leave an empty page at the end", () => {
    expect(pageRange(1, 100, 50)).toMatchObject({ pages: 2, hasNext: true });
    expect(pageRange(2, 100, 50)).toMatchObject({
      pages: 2,
      to: 100,
      hasNext: false,
    });
  });

  it("an empty list is one page that starts at zero", () => {
    expect(pageRange(1, 0, 50)).toMatchObject({
      pages: 1,
      from: 0,
      to: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });
});
