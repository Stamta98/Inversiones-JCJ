import { describe, expect, it } from "vitest";

import { ageOn, isGender, isPlausibleBirthDate, MAX_AGE_YEARS } from "../identity";

const today = new Date("2026-09-02T00:00:00.000Z");
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("isGender", () => {
  it("accepts what the form can send and nothing else", () => {
    expect(isGender("FEMALE")).toBe(true);
    expect(isGender("MALE")).toBe(true);
    expect(isGender("OTHER")).toBe(true);
    expect(isGender("")).toBe(false);
    expect(isGender("female")).toBe(false);
  });
});

describe("ageOn", () => {
  it("has no age without a birth date", () => {
    expect(ageOn(null, today)).toBeNull();
    expect(ageOn(undefined, today)).toBeNull();
  });

  it("counts completed years", () => {
    expect(ageOn(day("1990-01-15"), today)).toBe(36);
  });

  it("does not count a birthday that has not arrived", () => {
    expect(ageOn(day("1990-12-31"), today)).toBe(35);
  });

  it("counts the birthday itself", () => {
    expect(ageOn(day("1990-09-02"), today)).toBe(36);
    expect(ageOn(day("1990-09-03"), today)).toBe(35);
  });

  it("handles someone born on the 29th of February", () => {
    expect(ageOn(day("2000-02-29"), today)).toBe(26);
  });
});

describe("isPlausibleBirthDate", () => {
  it("accepts an ordinary date of birth", () => {
    expect(isPlausibleBirthDate(day("1985-06-10"), today)).toBe(true);
  });

  it("rejects a date in the future", () => {
    expect(isPlausibleBirthDate(day("2026-09-03"), today)).toBe(false);
    expect(isPlausibleBirthDate(day("2927-01-01"), today)).toBe(false);
  });

  it("accepts a newborn", () => {
    expect(isPlausibleBirthDate(day("2026-09-02"), today)).toBe(true);
  });

  it("rejects a year typed wrong in the other direction", () => {
    expect(isPlausibleBirthDate(day("1826-01-01"), today)).toBe(false);
  });

  it("accepts the oldest plausible person", () => {
    const oldest = new Date(today);
    oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_AGE_YEARS);
    expect(isPlausibleBirthDate(oldest, today)).toBe(true);
  });

  it("rejects a date that is not a date", () => {
    expect(isPlausibleBirthDate(new Date("no"), today)).toBe(false);
  });
});
