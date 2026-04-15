import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

/**
 * Gmail Email Provider
 * Implements IEmailProvider to send emails through Gmail SMTP
 * 
 * Configuration needed:
 * - GMAIL_EMAIL: Your Gmail email address
 * - GMAIL_APP_PASSWORD: Generated app password (16 characters)
 *   See: https://myaccount.google.com/apppasswords
 * - GMAIL_FROM_NAME: From name (optional, defaults to 'Notification')
 * 
 * Setup Instructions:
 * 1. Enable 2-Step Verification on your Gmail account
 * 2. Generate an App Password at https://myaccount.google.com/apppasswords
 * 3. Select "Mail" and "Windows Computer" (or relevant device)
 * 4. Copy the 16-character password and set GMAIL_APP_PASSWORD
 * 5. Set GMAIL_EMAIL to your Gmail address
 * 
 * Get started: https://support.google.com/accounts/answer/185833
 */
@Injectable()
export class GmailEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(GmailEmailProvider.name);
  private readonly gmailEmail: string;
  private readonly gmailAppPassword: string;
  private readonly fromName: string;
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.gmailEmail = process.env.GMAIL_EMAIL as string;
    this.gmailAppPassword = process.env.GMAIL_APP_PASSWORD as string;
    this.fromName = process.env.GMAIL_FROM_NAME || 'Notification';

    this.validateConfiguration();

    // Create Nodemailer transporter for Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.gmailEmail,
        pass: this.gmailAppPassword,
      },
    });
  }

  /**
   * Validate that all required Gmail environment variables are configured
   */
  private validateConfiguration(): void {
    this.logger.log('Validating Gmail configuration...');
    this.logger.log(`GMAIL_EMAIL: ${this.gmailEmail ? 'Configured' : 'Not Set'}`);
    this.logger.log(`GMAIL_APP_PASSWORD: ${this.gmailAppPassword ? 'Configured' : 'Not Set'}`);
    this.logger.log(`GMAIL_FROM_NAME: ${this.fromName}`);

    if (!this.gmailEmail) {
      throw new InternalServerErrorException(
        'GMAIL_EMAIL is not configured. Please set it in the environment variables.',
      );
    }

    if (!this.gmailAppPassword) {
      throw new InternalServerErrorException(
        'GMAIL_APP_PASSWORD is not configured. Please generate an app password at https://myaccount.google.com/apppasswords and set it in the environment variables.',
      );
    }
  }

  /**
   * Send email using Gmail SMTP
   * @param payload Email payload containing to, subject, text, and html
   * @returns Promise with messageId and status
   */
  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    try {
      this.logger.log(`Sending email via Gmail to ${payload.to}`);

      const mailOptions = {
        from: `${this.fromName} <${this.gmailEmail}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${payload.to}. Message ID: ${info.messageId}`);

      return {
        messageId: info.messageId || 'unknown',
        status: 'success',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error instanceof Error && 'response' in error ? (error as any).response : null;
      
      this.logger.error(`Failed to send email to ${payload.to}: ${errorMessage}`);

      if (errorResponse) {
        throw new ServiceUnavailableException(
          `Gmail service error: ${errorResponse}`,
        );
      }

      throw new InternalServerErrorException(
        `Failed to send email: ${errorMessage}`,
      );
    }
  }

  /**
   * Verify the transporter connection
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Gmail transporter connection verified successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to verify Gmail transporter: ${errorMessage}`);
      throw new ServiceUnavailableException(
        `Gmail connection error: ${errorMessage}`,
      );
    }
  }
}
