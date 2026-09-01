import { describe, expect, it } from "vitest";

import {
  TemplateRenderError,
  extractVariables,
  findUnknownVariables,
  renderTemplate,
} from "../render";
import { TEMPLATE_VARIABLES, canonicalVariableKey } from "../variables";

const context = {
  customer: { firstName: "María", fullName: "María Pérez" },
  loan: { code: "PRE-000045", daysInArrears: 7 },
  installment: { totalDue: "RD$ 3,850.00", dueDate: "15/03/2026" },
  company: { name: "Inversiones JCJ" },
};

describe("renderTemplate", () => {
  it("replaces canonical English tokens", () => {
    expect(
      renderTemplate("Hola {{customer.firstName}}, saludos.", context),
    ).toBe("Hola María, saludos.");
  });

  it("replaces Spanish aliases with the same value", () => {
    expect(renderTemplate("Hola {{cliente.nombre}}.", context)).toBe(
      "Hola María.",
    );
  });

  it("tolerates spaces inside the braces", () => {
    expect(renderTemplate("{{  cliente.nombre  }}", context)).toBe("María");
  });

  it("renders a full collection message", () => {
    const body =
      "Hola {{cliente.nombre}}, tu cuota del préstamo {{prestamo.numero}} " +
      "venció el {{cuota.vencimiento}} y tienes {{prestamo.diasMora}} días de mora. " +
      "Debes pagar {{cuota.totalAPagar}}. Gracias, {{empresa.nombre}}.";

    expect(renderTemplate(body, context)).toBe(
      "Hola María, tu cuota del préstamo PRE-000045 venció el 15/03/2026 y " +
        "tienes 7 días de mora. Debes pagar RD$ 3,850.00. Gracias, Inversiones JCJ.",
    );
  });

  it("uses the fallback for a known variable with no value", () => {
    expect(
      renderTemplate("Recibo {{cobro.recibo}}.", context, { fallback: "—" }),
    ).toBe("Recibo —.");
  });

  it("leaves an unknown placeholder untouched by default", () => {
    expect(renderTemplate("Hola {{cliente.inventado}}.", context)).toBe(
      "Hola {{cliente.inventado}}.",
    );
  });

  it("throws on an unknown placeholder in strict mode", () => {
    expect(() =>
      renderTemplate("{{cliente.inventado}}", context, { strict: true }),
    ).toThrow(TemplateRenderError);
  });

  it("renders a zero without swallowing it", () => {
    expect(
      renderTemplate("{{prestamo.diasMora}}", {
        loan: { daysInArrears: 0 },
      }),
    ).toBe("0");
  });
});

describe("extractVariables", () => {
  it("canonicalizes and de-duplicates", () => {
    expect(
      extractVariables("{{cliente.nombre}} {{customer.firstName}} {{prestamo.saldo}}"),
    ).toEqual(["customer.firstName", "loan.outstanding"]);
  });
});

describe("findUnknownVariables", () => {
  it("reports only the tokens that do not exist", () => {
    expect(
      findUnknownVariables("{{cliente.nombre}} {{cliente.zapato}}"),
    ).toEqual(["cliente.zapato"]);
  });
});

describe("TEMPLATE_VARIABLES", () => {
  it("has unique keys and aliases", () => {
    const keys = TEMPLATE_VARIABLES.map((v) => v.key);
    const aliases = TEMPLATE_VARIABLES.map((v) => v.alias);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("maps every alias back to its key", () => {
    for (const variable of TEMPLATE_VARIABLES) {
      expect(canonicalVariableKey(variable.alias)).toBe(variable.key);
      expect(canonicalVariableKey(variable.key)).toBe(variable.key);
    }
  });
});
