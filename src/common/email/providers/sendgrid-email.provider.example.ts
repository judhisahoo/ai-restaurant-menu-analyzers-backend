/**
 * @file sendgrid-email.provider.example.ts
 * 
 * Example implementation of SendGrid email provider
 * This file demonstrates how to add a new email provider to the system.
 * 
 * To use this provider:
 * 1. Rename this file to: sendgrid-email.provider.ts
 * 2. Update email.module.ts to import SendgridEmailProvider
 * 3. Change the IEmailProvider useClass to: useClass: SendgridEmailProvider
 * 4. Add these environment variables:
 *    - SENDGRID_API_KEY=your_sendgrid_api_key
 *    - SENDGRID_FROM_EMAIL=noreply@yourdomain.com
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

@Injectable()
export class SendgridEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(SendgridEmailProvider.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY as string;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL as string;

    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    this.logger.log('Validating SendGrid configuration...');
    this.logger.log(`SENDGRID_API_KEY: ${this.apiKey ? 'Configured' : 'Not Set'}`);
    this.logger.log(`SENDGRID_FROM_EMAIL: ${this.fromEmail || 'Not Set'}`);

    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'SENDGRID_API_KEY environment variable is not configured.',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'SENDGRID_FROM_EMAIL environment variable is not configured.',
      );
    }
  }

  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    const { to, subject, text, html } = payload;

    this.logger.log(`Preparing to send email to ${to} with subject: ${subject}`);

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to }],
              subject: subject,
            },
          ],
          from: {
            email: this.fromEmail,
          },
          content: [
            {
              type: 'text/plain',
              value: text,
            },
            {
              type: 'text/html',
              value: html,
            },
          ],
          tracking_settings: {
            click_tracking: {
              enable: false,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SendGrid API error: ${response.status}${errorText ? ` - ${errorText}` : ''}`,
        );
      }

      const messageId = response.headers.get('x-message-id') || 'unknown';
      this.logger.log(`Email sent successfully. Message ID: ${messageId}`);

      return {
        messageId,
        status: 'sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SendGrid error';
      this.logger.error(`Failed to send email via SendGrid: ${errorMessage}`, error);
      throw new ServiceUnavailableException(
        `Failed to send email via SendGrid: ${errorMessage}`,
      );
    }
  }
}
