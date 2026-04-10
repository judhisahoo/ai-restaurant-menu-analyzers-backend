import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

/**
 * Mailgun Email Provider
 * Implements IEmailProvider to send emails through Mailgun API
 * Configuration is loaded from environment variables
 */
@Injectable()
export class MailgunEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MailgunEmailProvider.name);
  private readonly apiKey: string;
  private readonly domain: string;
  private readonly fromEmail: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.MAILGUN_API_KEY as string;
    this.domain = process.env.MAILGUN_DOMAIN as string;
    this.fromEmail = process.env.MAILGUN_FROM_EMAIL as string;
    this.baseUrl = process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net';

    this.validateConfiguration();
  }

  /**
   * Validate that all required Mailgun environment variables are configured
   */
  private validateConfiguration(): void {
    this.logger.log('Validating Mailgun configuration...');
    this.logger.log(`MAILGUN_API_KEY: ${this.apiKey ? 'Configured' : 'Not Set'}`);
    this.logger.log(`MAILGUN_DOMAIN: ${this.domain || 'Not Set'}`);
    this.logger.log(`MAILGUN_FROM_EMAIL: ${this.fromEmail || 'Not Set'}`);
    this.logger.log(`MAILGUN_BASE_URL: ${this.baseUrl}`);

    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'MAILGUN_API_KEY environment variable is not configured.',
      );
    }

    if (!this.domain) {
      throw new InternalServerErrorException(
        'MAILGUN_DOMAIN environment variable is not configured.',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'MAILGUN_FROM_EMAIL environment variable is not configured.',
      );
    }
  }

  /**
   * Send email via Mailgun API
   * @param payload Email payload containing to, subject, text, and html
   * @returns Message ID and status
   */
  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    const { to, subject, text, html } = payload;

    this.logger.log(`Preparing to send email to ${to} with subject: ${subject}`);

    try {
      const formData = new FormData();
      formData.append('from', this.fromEmail);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', html);
      formData.append('o:tracking', 'no');

      const authHeader = Buffer.from(`api:${this.apiKey}`).toString('base64');
      const response = await fetch(
        `${this.baseUrl}/v3/${encodeURIComponent(this.domain)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Mailgun rejected request with status ${response.status}${errorText ? `: ${errorText}` : ''}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Email sent successfully. Message ID: ${result.id}`);

      return {
        messageId: result.id,
        status: 'sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Mailgun error';
      this.logger.error(`Failed to send email via Mailgun: ${errorMessage}`, error);
      throw new ServiceUnavailableException(
        `Failed to send email via Mailgun: ${errorMessage}`,
      );
    }
  }
}
