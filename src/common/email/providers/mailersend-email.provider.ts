import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

/**
 * MailerSend Email Provider (SMTP)
 * Implements IEmailProvider to send emails through MailerSend SMTP
 * MailerSend is a modern email service with excellent templates, analytics, and reliability
 * 
 * Configuration needed:
 * - MAILERSEND_SMTP_HOST: smtp.mailersend.com
 * - MAILERSEND_SMTP_PORT: 587 (TLS) or 465 (SSL)
 * - MAILERSEND_SMTP_USER: Your MailerSend username/API key
 * - MAILERSEND_SMTP_PASS: Your MailerSend password/API token
 * - MAILERSEND_FROM_EMAIL: From email address (must be verified in MailerSend)
 * - MAILERSEND_FROM_NAME: From name (optional)
 * 
 * Get started: https://www.mailersend.com
 * 
 * Note: Requires nodemailer package - install with: npm install nodemailer
 * For TypeScript, also install: npm install --save-dev @types/nodemailer
 */
@Injectable()
export class MailerSendEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MailerSendEmailProvider.name);
  private transporter!: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    this.fromEmail = process.env.MAILERSEND_FROM_EMAIL as string;
    this.fromName = process.env.MAILERSEND_FROM_NAME || 'Notification';

    this.validateConfiguration();
    this.initializeTransporter();
  }

  /**
   * Validate that all required MailerSend SMTP environment variables are configured
   */
  private validateConfiguration(): void {
    this.logger.log('Validating MailerSend SMTP configuration...');
    this.logger.log(`MAILERSEND_SMTP_HOST: ${process.env.MAILERSEND_SMTP_HOST || 'Not Set'}`);
    this.logger.log(`MAILERSEND_SMTP_PORT: ${process.env.MAILERSEND_SMTP_PORT || 'Not Set'}`);
    this.logger.log(`MAILERSEND_SMTP_USER: ${process.env.MAILERSEND_SMTP_USER ? 'Configured' : 'Not Set'}`);
    this.logger.log(`MAILERSEND_SMTP_PASS: ${process.env.MAILERSEND_SMTP_PASS ? 'Configured' : 'Not Set'}`);
    this.logger.log(`MAILERSEND_FROM_EMAIL: ${this.fromEmail || 'Not Set'}`);
    this.logger.log(`MAILERSEND_FROM_NAME: ${this.fromName}`);

    if (!process.env.MAILERSEND_SMTP_HOST) {
      throw new InternalServerErrorException(
        'MAILERSEND_SMTP_HOST environment variable is not configured.',
      );
    }

    if (!process.env.MAILERSEND_SMTP_PORT) {
      throw new InternalServerErrorException(
        'MAILERSEND_SMTP_PORT environment variable is not configured.',
      );
    }

    if (!process.env.MAILERSEND_SMTP_USER) {
      throw new InternalServerErrorException(
        'MAILERSEND_SMTP_USER environment variable is not configured.',
      );
    }

    if (!process.env.MAILERSEND_SMTP_PASS) {
      throw new InternalServerErrorException(
        'MAILERSEND_SMTP_PASS environment variable is not configured.',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'MAILERSEND_FROM_EMAIL environment variable is not configured.',
      );
    }
  }

  /**
   * Initialize nodemailer transporter for MailerSend SMTP
   */
  private initializeTransporter(): void {
    try {
      const port = parseInt(process.env.MAILERSEND_SMTP_PORT as string, 10);
      const isSecure = port === 465; // Use secure connection for port 465 (SSL)

      this.transporter = nodemailer.createTransport({
        host: process.env.MAILERSEND_SMTP_HOST,
        port: port,
        secure: isSecure,
        auth: {
          user: process.env.MAILERSEND_SMTP_USER,
          pass: process.env.MAILERSEND_SMTP_PASS,
        },
      });

      this.logger.log('MailerSend SMTP transporter initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize MailerSend SMTP transporter: ${errorMessage}`);
      throw new InternalServerErrorException(
        `Failed to initialize email transporter: ${errorMessage}`,
      );
    }
  }

  /**
   * Send email via MailerSend SMTP
   * @param payload Email payload containing to, subject, text, and html
   * @returns Message ID and status
   */
  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    const { to, subject, text, html } = payload;

    this.logger.log(`Preparing to send email to ${to} with subject: ${subject}`);

    try {
      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: to,
        subject: subject,
        text: text,
        html: html,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully via MailerSend SMTP. Message ID: ${result.messageId}`);

      return {
        messageId: result.messageId || result.response || 'unknown',
        status: 'sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown MailerSend SMTP error';
      this.logger.error(`Failed to send email via MailerSend SMTP: ${errorMessage}`, error);
      throw new ServiceUnavailableException(
        `Failed to send email via MailerSend SMTP: ${errorMessage}`,
      );
    }
  }

  /**
   * Verify the transporter connection
   * Useful for testing SMTP connectivity
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('MailerSend SMTP connection verified successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to verify MailerSend SMTP connection: ${errorMessage}`);
      return false;
    }
  }
}

