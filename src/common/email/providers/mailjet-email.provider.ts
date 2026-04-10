import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

/**
 * Mailjet Email Provider
 * Implements IEmailProvider to send emails through Mailjet API
 * Mailjet is a powerful, scalable email service with excellent delivery rates
 * 
 * Configuration needed:
 * - MAILJET_API_KEY: Your Mailjet API key
 * - MAILJET_SECRET_KEY: Your Mailjet secret key
 * - MAILJET_FROM_EMAIL: From email address (must be verified in Mailjet dashboard)
 * - MAILJET_FROM_NAME: From name (optional)
 * 
 * Get started: https://www.mailjet.com
 */
@Injectable()
export class MailjetEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MailjetEmailProvider.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly baseUrl = 'https://api.mailjet.com/v3.1';

  constructor() {
    this.apiKey = process.env.MAILJET_API_KEY as string;
    this.secretKey = process.env.MAILJET_SECRET_KEY as string;
    this.fromEmail = process.env.MAILJET_FROM_EMAIL as string;
    this.fromName = process.env.MAILJET_FROM_NAME || 'Notification';

    this.validateConfiguration();
  }

  /**
   * Validate that all required Mailjet environment variables are configured
   */
  private validateConfiguration(): void {
    this.logger.log('Validating Mailjet configuration...');
    this.logger.log(`MAILJET_API_KEY: ${this.apiKey ? 'Configured' : 'Not Set'}`);
    this.logger.log(`MAILJET_SECRET_KEY: ${this.secretKey ? 'Configured' : 'Not Set'}`);
    this.logger.log(`MAILJET_FROM_EMAIL: ${this.fromEmail || 'Not Set'}`);
    this.logger.log(`MAILJET_FROM_NAME: ${this.fromName}`);

    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'MAILJET_API_KEY environment variable is not configured.',
      );
    }

    if (!this.secretKey) {
      throw new InternalServerErrorException(
        'MAILJET_SECRET_KEY environment variable is not configured.',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'MAILJET_FROM_EMAIL environment variable is not configured.',
      );
    }
  }

  /**
   * Send email via Mailjet API
   * @param payload Email payload containing to, subject, text, and html
   * @returns Message ID and status
   */
  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    const { to, subject, text, html } = payload;

    this.logger.log(`Preparing to send email to ${to} with subject: ${subject}`);

    try {
      // Create Basic Auth header from API key and secret
      const authString = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');

      const response = await fetch(`${this.baseUrl}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: this.fromEmail,
                Name: this.fromName,
              },
              To: [
                {
                  Email: to,
                },
              ],
              Subject: subject,
              TextPart: text,
              HTMLPart: html,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.Message || `Mailjet API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const messageId =
        result.Messages?.[0]?.ID || result.Messages?.[0]?.MessageID || 'unknown';

      this.logger.log(`Email sent successfully via Mailjet. Message ID: ${messageId}`);

      return {
        messageId,
        status: 'sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Mailjet error';
      this.logger.error(`Failed to send email via Mailjet: ${errorMessage}`, error);
      throw new ServiceUnavailableException(
        `Failed to send email via Mailjet: ${errorMessage}`,
      );
    }
  }
}
