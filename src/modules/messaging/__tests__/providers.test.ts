import { describe, expect, it } from "vitest";

import {
  LogProvider,
  MissingCredentialsError,
  UnknownProviderError,
  createProvider,
  formatPhoneNumber,
  normalizePhoneNumber,
} from "../providers";

describe("createProvider", () => {
  it("builds the log provider with no credentials", () => {
    const provider = createProvider("log");
    expect(provider).toBeInstanceOf(LogProvider);
    expect(provider.channel).toBe("WHATSAPP");
  });

  it("builds the cloud api provider when credentials are complete", () => {
    const provider = createProvider("cloud_api", {
      accessToken: "token",
      phoneNumberId: "123",
    });
    expect(provider.key).toBe("cloud_api");
  });

  it("reports the missing credential by name", () => {
    expect(() => createProvider("cloud_api", { accessToken: "token" })).toThrow(
      MissingCredentialsError,
    );
    expect(() => createProvider("bridge", {})).toThrow(MissingCredentialsError);
  });

  it("rejects an unknown provider", () => {
    expect(() => createProvider("telepathy")).toThrow(UnknownProviderError);
  });
});

describe("LogProvider", () => {
  it("records instead of sending", async () => {
    const provider = new LogProvider();
    const result = await provider.send({ to: "18095550123", body: "Hola" });

    expect(result.ok).toBe(true);
    expect(provider.sent).toEqual([{ to: "18095550123", body: "Hola" }]);
  });
});

describe("normalizePhoneNumber", () => {
  const options = { defaultCountryCode: "1", nationalNumberLength: 10 };

  it("strips punctuation from an international number", () => {
    expect(normalizePhoneNumber("+1 (809) 555-0123")).toBe("18095550123");
  });

  it("adds the default country code to a bare national number", () => {
    expect(normalizePhoneNumber("809-555-0123", options)).toBe("18095550123");
  });

  it("drops a national trunk prefix", () => {
    expect(normalizePhoneNumber("0809 555 0123", options)).toBe("18095550123");
  });

  it("understands the 00 international prefix", () => {
    expect(normalizePhoneNumber("0018095550123", options)).toBe("18095550123");
  });

  it("leaves an already international number alone", () => {
    expect(normalizePhoneNumber("18095550123", options)).toBe("18095550123");
    expect(normalizePhoneNumber("+52 55 1234 5678", options)).toBe(
      "525512345678",
    );
  });

  it("rejects rubbish", () => {
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber("no tengo")).toBeNull();
    expect(normalizePhoneNumber("123")).toBeNull();
    expect(normalizePhoneNumber("1".repeat(20))).toBeNull();
  });
});

describe("formatPhoneNumber", () => {
  it("renders back in E.164", () => {
    expect(formatPhoneNumber("18095550123")).toBe("+18095550123");
  });
});
