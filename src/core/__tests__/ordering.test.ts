import { describe, expect, it } from "vitest";

import {
  changedPositions,
  isManuallyOrdered,
  moveRelativeTo,
} from "../ordering";

const ids = ["a", "b", "c", "d"];

describe("moveRelativeTo", () => {
  it("puts a row before another", () => {
    expect(moveRelativeTo(ids, "c", "b", "before")).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("puts a row after another", () => {
    expect(moveRelativeTo(ids, "a", "c", "after")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("sends a row to the front", () => {
    expect(moveRelativeTo(ids, "d", null, "top")).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("leaves a row that is already at the front alone", () => {
    expect(moveRelativeTo(ids, "a", null, "top")).toEqual(ids);
  });

  // The list on screen may be filtered, so the row a person clicks below is
  // not always the next one in the full list. Moving across the gap is the
  // point, not a bug.
  it("moves across rows the person could not see", () => {
    expect(moveRelativeTo(ids, "d", "a", "before")).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  // A stale page should do nothing rather than something surprising.
  it("ignores a row that is not in the list", () => {
    expect(moveRelativeTo(ids, "z", "b", "before")).toEqual(ids);
  });

  it("ignores a target that is gone", () => {
    expect(moveRelativeTo(ids, "a", "z", "before")).toEqual(ids);
  });

  it("ignores a row asked to move next to itself", () => {
    expect(moveRelativeTo(ids, "b", "b", "before")).toEqual(ids);
  });
});

describe("changedPositions", () => {
  // Everything starts at zero, so the first move numbers the whole list —
  // except whatever ends up first, which is already sitting at zero.
  it("numbers a list that nobody has ordered yet", () => {
    const current = new Map(ids.map((id) => [id, 0]));

    expect(changedPositions(["c", "a", "b", "d"], current)).toEqual([
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "d", sortOrder: 3 },
    ]);
  });

  // Later moves are cheap: only the rows between the old and the new spot.
  it("writes back only what moved", () => {
    const current = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);

    expect(changedPositions(["a", "c", "b", "d"], current)).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("writes nothing when nothing moved", () => {
    const current = new Map([
      ["a", 0],
      ["b", 1],
    ]);

    expect(changedPositions(["a", "b"], current)).toEqual([]);
  });
});

describe("isManuallyOrdered", () => {
  it("is false while every row sits at zero", () => {
    expect(isManuallyOrdered([{ sortOrder: 0 }, { sortOrder: 0 }])).toBe(false);
  });

  it("is true once anything has been moved", () => {
    expect(isManuallyOrdered([{ sortOrder: 0 }, { sortOrder: 3 }])).toBe(true);
  });

  it("is false for an empty list", () => {
    expect(isManuallyOrdered([])).toBe(false);
  });
});
