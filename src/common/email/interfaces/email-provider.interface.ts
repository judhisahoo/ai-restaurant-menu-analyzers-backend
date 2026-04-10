/**
 * Email Provider Interface
 * Defines the contract that all email providers must implement.
 * This allows for easy swapping between providers (Mailgun, SendGrid, AWS SES, etc.)
 */

export interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface IEmailProvider {
  /**
   * Send an email using the provider
   * @param payload Email payload containing to, subject, text, and html
   * @returns Promise with the result of the send operation
   */
  send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }>;
}
