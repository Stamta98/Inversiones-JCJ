import { describe, expect, it } from "vitest";

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidUsername,
  looksLikeEmail,
  normalizeUsername,
  suggestUsername,
} from "../username";

describe("normalizeUsername", () => {
  it("ignores case and surrounding spaces", () => {
    expect(normalizeUsername("  JuanCarlos  ")).toBe("juancarlos");
  });
});

describe("isValidUsername", () => {
  it("accepts letters, digits and inner separators", () => {
    expect(isValidUsername("juan.carlos")).toBe(true);
    expect(isValidUsername("cobrador_2")).toBe(true);
    expect(isValidUsername("jc-99")).toBe(true);
  });

  it("accepts what only differs in case or spacing", () => {
    expect(isValidUsername(" Admin ")).toBe(true);
  });

  it("rejects anything with an @, so it cannot pass for an email", () => {
    expect(isValidUsername("juan@jcj.com")).toBe(false);
  });

  it("rejects spaces, accents and other symbols", () => {
    expect(isValidUsername("juan carlos")).toBe(false);
    expect(isValidUsername("josé")).toBe(false);
    expect(isValidUsername("juan/carlos")).toBe(false);
  });

  it("rejects leading or trailing separators", () => {
    expect(isValidUsername(".juan")).toBe(false);
    expect(isValidUsername("juan-")).toBe(false);
  });

  it("enforces the length limits", () => {
    expect(isValidUsername("a".repeat(USERNAME_MIN_LENGTH - 1))).toBe(false);
    expect(isValidUsername("a".repeat(USERNAME_MIN_LENGTH))).toBe(true);
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH))).toBe(true);
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("looksLikeEmail", () => {
  it("separates the two ways of signing in", () => {
    expect(looksLikeEmail("admin@inversionesjcj.com")).toBe(true);
    expect(looksLikeEmail("admin")).toBe(false);
  });
});

describe("suggestUsername", () => {
  it("takes the local part of an email", () => {
    expect(suggestUsername("juan.carlos@inversionesjcj.com")).toBe(
      "juan.carlos",
    );
  });

  it("strips accents and spaces out of a name", () => {
    expect(suggestUsername("José Martínez")).toBe("jose.martinez");
  });

  it("never suggests something it would then reject", () => {
    for (const source of [
      "José Martínez",
      "juan.carlos@inversionesjcj.com",
      "...raro...@x.com",
      "Ana",
      "A B",
      "x".repeat(60),
    ]) {
      expect(isValidUsername(suggestUsername(source))).toBe(true);
    }
  });

  it("gives back nothing when there is nothing usable", () => {
    expect(suggestUsername("@@@")).toBe("");
    expect(suggestUsername("   ")).toBe("");
  });
});
