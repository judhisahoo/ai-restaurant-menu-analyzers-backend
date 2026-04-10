import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

/**
 * Resend Email Provider
 * Implements IEmailProvider to send emails through Resend API
 * Resend is a modern email service optimized for transactional emails
 * 
 * Configuration needed:
 * - RESEND_API_KEY: Your Resend API key
 * - RESEND_FROM_EMAIL: From email address (must be verified in Resend dashboard)
 * 
 * Get started: https://resend.com
 */
@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly baseUrl = 'https://api.resend.com';

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY as string;
    this.fromEmail = process.env.RESEND_FROM_EMAIL as string;

    this.validateConfiguration();
  }

  /**
   * Validate that all required Resend environment variables are configured
   */
  private validateConfiguration(): void {
    this.logger.log('Validating Resend configuration...');
    this.logger.log(`RESEND_API_KEY: ${this.apiKey ? 'Configured' : 'Not Set'}`);
    this.logger.log(`RESEND_FROM_EMAIL: ${this.fromEmail || 'Not Set'}`);

    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY environment variable is not configured.',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'RESEND_FROM_EMAIL environment variable is not configured.',
      );
    }
  }

  /**
   * Send email via Resend API
   * @param payload Email payload containing to, subject, text, and html
   * @returns Message ID and status
   */
  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    const { to, subject, text, html } = payload;

    this.logger.log(`Preparing to send email to ${to} with subject: ${subject}`);

    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: to,
          subject: subject,
          html: html,
          text: text,
          reply_to: this.fromEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || `Resend API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      this.logger.log(`Email sent successfully via Resend. Message ID: ${result.id}`);

      return {
        messageId: result.id,
        status: 'sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Resend error';
      this.logger.error(`Failed to send email via Resend: ${errorMessage}`, error);
      throw new ServiceUnavailableException(
        `Failed to send email via Resend: ${errorMessage}`,
      );
    }
  }
}
