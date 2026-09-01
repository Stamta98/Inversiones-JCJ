/**
 * Messaging provider contract.
 *
 * The rest of the system only ever talks to this interface, so a company can
 * switch between the official WhatsApp Business API and their own connected
 * number without any change outside this folder.
 */

export type MessagingChannel = "WHATSAPP" | "SMS" | "EMAIL";

export interface SendMessageInput {
  /** Destination in E.164 form for WhatsApp and SMS, an address for email. */
  to: string;
  body: string;
  subject?: string;
  /** Correlation id stored on OutboundMessage, useful for provider logs. */
  reference?: string;
}

export interface SendMessageResult {
  ok: boolean;
  /** Provider side identifier, stored to reconcile delivery reports. */
  providerMessageId?: string;
  failureReason?: string;
  /** True when retrying later could succeed (network, rate limit, 5xx). */
  retryable?: boolean;
}

export interface MessagingProvider {
  readonly key: string;
  readonly channel: MessagingChannel;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

export interface ProviderCredentials {
  [key: string]: unknown;
}
