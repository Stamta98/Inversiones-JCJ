/**
 * Bridge provider: "connect your own WhatsApp".
 *
 * Talks to a self hosted bridge service that keeps a session against a real
 * WhatsApp account and exposes a minimal HTTP contract:
 *
 *   POST {baseUrl}/messages
 *   Authorization: Bearer {token}
 *   { "to": "18095550123", "body": "..." }
 *   -> 200 { "id": "..." }  |  4xx/5xx { "error": "..." }
 *
 * Keeping the bridge behind this interface means the actual transport can be
 * swapped without touching the collection logic.
 */

import type {
  MessagingProvider,
  SendMessageInput,
  SendMessageResult,
} from "./types";

export interface BridgeCredentials {
  baseUrl: string;
  token: string;
}

export class WhatsAppBridgeProvider implements MessagingProvider {
  readonly key = "bridge";
  readonly channel = "WHATSAPP" as const;

  constructor(private readonly credentials: BridgeCredentials) {}

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const baseUrl = this.credentials.baseUrl.replace(/\/+$/, "");

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.credentials.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: input.to,
          body: input.body,
          reference: input.reference,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          failureReason: payload.error ?? `HTTP ${response.status}`,
          retryable: response.status >= 500 || response.status === 429,
        };
      }

      return { ok: true, providerMessageId: payload.id };
    } catch (error) {
      return {
        ok: false,
        failureReason:
          error instanceof Error ? error.message : "Network failure",
        retryable: true,
      };
    }
  }
}
