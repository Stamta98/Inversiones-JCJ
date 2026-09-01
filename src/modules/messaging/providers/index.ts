/**
 * Provider factory.
 */

import { WhatsAppBridgeProvider, type BridgeCredentials } from "./bridge";
import {
  WhatsAppCloudApiProvider,
  type CloudApiCredentials,
} from "./cloud-api";
import { LogProvider } from "./log";
import type { MessagingProvider, ProviderCredentials } from "./types";

export const PROVIDER_KEYS = ["cloud_api", "bridge", "log"] as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export class UnknownProviderError extends Error {
  constructor(readonly providerKey: string) {
    super(`Unknown messaging provider: ${providerKey}`);
    this.name = "UnknownProviderError";
  }
}

export class MissingCredentialsError extends Error {
  constructor(
    readonly providerKey: string,
    readonly field: string,
  ) {
    super(`Provider ${providerKey} is missing credential "${field}"`);
    this.name = "MissingCredentialsError";
  }
}

function requireString(
  providerKey: string,
  credentials: ProviderCredentials,
  field: string,
): string {
  const value = credentials[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MissingCredentialsError(providerKey, field);
  }
  return value;
}

export function createProvider(
  providerKey: string,
  credentials: ProviderCredentials = {},
): MessagingProvider {
  switch (providerKey) {
    case "cloud_api":
      return new WhatsAppCloudApiProvider({
        accessToken: requireString(providerKey, credentials, "accessToken"),
        phoneNumberId: requireString(
          providerKey,
          credentials,
          "phoneNumberId",
        ),
        apiVersion:
          typeof credentials.apiVersion === "string"
            ? credentials.apiVersion
            : undefined,
      } satisfies CloudApiCredentials);

    case "bridge":
      return new WhatsAppBridgeProvider({
        baseUrl: requireString(providerKey, credentials, "baseUrl"),
        token: requireString(providerKey, credentials, "token"),
      } satisfies BridgeCredentials);

    case "log":
      return new LogProvider();

    default:
      throw new UnknownProviderError(providerKey);
  }
}

export { LogProvider, WhatsAppBridgeProvider, WhatsAppCloudApiProvider };
export type { MessagingProvider, ProviderCredentials };
export * from "./phone";
export type { SendMessageInput, SendMessageResult } from "./types";
