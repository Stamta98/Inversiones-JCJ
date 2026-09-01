/**
 * Log provider: records what would have been sent without contacting anyone.
 * This is the default so a fresh install can never message a real customer
 * by accident, and it is what the automated tests run against.
 */

import type {
  MessagingProvider,
  SendMessageInput,
  SendMessageResult,
} from "./types";

export class LogProvider implements MessagingProvider {
  readonly key = "log";
  readonly channel = "WHATSAPP" as const;

  readonly sent: SendMessageInput[] = [];

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    this.sent.push(input);
    return {
      ok: true,
      providerMessageId: `log-${this.sent.length}`,
    };
  }
}
