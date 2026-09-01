/**
 * WhatsApp Business Cloud API provider (the official Meta endpoint).
 */

import type {
  MessagingProvider,
  SendMessageInput,
  SendMessageResult,
} from "./types";

export interface CloudApiCredentials {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class WhatsAppCloudApiProvider implements MessagingProvider {
  readonly key = "cloud_api";
  readonly channel = "WHATSAPP" as const;

  constructor(private readonly credentials: CloudApiCredentials) {}

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const version = this.credentials.apiVersion ?? "v21.0";
    const url = `https://graph.facebook.com/${version}/${this.credentials.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to,
          type: "text",
          text: { preview_url: false, body: input.body },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          ok: false,
          failureReason:
            payload.error?.message ?? `HTTP ${response.status}`,
          retryable: RETRYABLE_STATUS_CODES.has(response.status),
        };
      }

      return {
        ok: true,
        providerMessageId: payload.messages?.[0]?.id,
      };
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
