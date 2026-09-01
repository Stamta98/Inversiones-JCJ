import { describe, expect, it } from "vitest";

import { createTranslator, flattenDictionary, t } from "..";

describe("t", () => {
  it("resolves nested keys", () => {
    expect(t("loans.title")).toBe("Préstamos");
    expect(t("loans.status.IN_ARREARS")).toBe("En mora");
  });

  it("interpolates placeholders", () => {
    expect(t("dashboard.greeting", { name: "Ana" })).toBe("Hola, Ana");
  });

  it("leaves an unknown placeholder untouched", () => {
    expect(t("dashboard.greeting")).toBe("Hola, {name}");
  });

  it("returns the key when the translation is missing", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});

describe("createTranslator", () => {
  it("prefers a company override", () => {
    const translate = createTranslator({
      overrides: { "loans.title": "Créditos" },
    });
    expect(translate("loans.title")).toBe("Créditos");
    expect(translate("customers.title")).toBe("Clientes");
  });

  it("falls back to the dictionary when the override is blank", () => {
    const translate = createTranslator({ overrides: { "loans.title": "" } });
    expect(translate("loans.title")).toBe("Préstamos");
  });

  it("interpolates inside an override", () => {
    const translate = createTranslator({
      overrides: { "dashboard.greeting": "Buenas, {name}" },
    });
    expect(translate("dashboard.greeting", { name: "Luis" })).toBe(
      "Buenas, Luis",
    );
  });
});

describe("flattenDictionary", () => {
  it("produces dot separated keys for the labels editor", () => {
    const flat = flattenDictionary();
    expect(flat["loans.status.PAID"]).toBe("Saldado");
    expect(Object.keys(flat).length).toBeGreaterThan(200);
    expect(
      Object.values(flat).every((value) => typeof value === "string"),
    ).toBe(true);
  });
});
