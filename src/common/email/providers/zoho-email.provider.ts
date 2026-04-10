import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

/**
 * Zoho Mail Email Provider (SMTP)
 * Implements IEmailProvider to send emails through Zoho Mail SMTP
 * Zoho Mail is a secure, privacy-focused email service with excellent reliability
 * 
 * Configuration needed:
 * - ZOHO_SMTP_HOST: smtp.zoho.com (or smtp.zoho.eu for EU, smtp.zoho.in for India)
 * - ZOHO_SMTP_PORT: 587 (TLS) or 465 (SSL)
 * - ZOHO_SMTP_USER: Your Zoho Mail email address
 * - ZOHO_SMTP_PASS: Your Zoho Mail password or app-specific password
 * - ZOHO_FROM_EMAIL: From email address (must be your Zoho Mail email)
 * - ZOHO_FROM_NAME: From name (optional)
 * 
 * Get started: https://www.zoho.com/mail
 * SMTP Setup: https://www.zoho.com/mail/help/zoho-mail-smtp-configuration.html
 * 
 * Note: For enhanced security, generate an app password in Zoho Mail settings
 * For TypeScript, install: npm install nodemailer @types/nodemailer
 */
@Injectable()
export class ZohoEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(ZohoEmailProvider.name);
  private transporter!: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    this.fromEmail = process.env.ZOHO_FROM_EMAIL as string;
    this.fromName = process.env.ZOHO_FROM_NAME || 'Notification';

    this.validateConfiguration();
    this.initializeTransporter();
  }

  /**
   * Validate that all required Zoho Mail SMTP environment variables are configured
   */
  private validateConfiguration(): void {
    this.logger.log('Validating Zoho Mail SMTP configuration...');
    this.logger.log(`ZOHO_SMTP_HOST: ${process.env.ZOHO_SMTP_HOST || 'Not Set'}`);
    this.logger.log(`ZOHO_SMTP_PORT: ${process.env.ZOHO_SMTP_PORT || 'Not Set'}`);
    this.logger.log(`ZOHO_SMTP_USER: ${process.env.ZOHO_SMTP_USER ? 'Configured' : 'Not Set'}`);
    this.logger.log(`ZOHO_SMTP_PASS: ${process.env.ZOHO_SMTP_PASS ? 'Configured' : 'Not Set'}`);
    this.logger.log(`ZOHO_FROM_EMAIL: ${this.fromEmail || 'Not Set'}`);
    this.logger.log(`ZOHO_FROM_NAME: ${this.fromName}`);

    if (!process.env.ZOHO_SMTP_HOST) {
      throw new InternalServerErrorException(
        'ZOHO_SMTP_HOST environment variable is not configured.',
      );
    }

    if (!process.env.ZOHO_SMTP_PORT) {
      throw new InternalServerErrorException(
        'ZOHO_SMTP_PORT environment variable is not configured.',
      );
    }

    if (!process.env.ZOHO_SMTP_USER) {
      throw new InternalServerErrorException(
        'ZOHO_SMTP_USER environment variable is not configured.',
      );
    }

    if (!process.env.ZOHO_SMTP_PASS) {
      throw new InternalServerErrorException(
        'ZOHO_SMTP_PASS environment variable is not configured.',
      );
    }

    if (!this.fromEmail) {
      throw new InternalServerErrorException(
        'ZOHO_FROM_EMAIL environment variable is not configured.',
      );
    }
  }

  /**
   * Initialize nodemailer transporter for Zoho Mail SMTP
   */
  private initializeTransporter(): void {
    try {
      const port = parseInt(process.env.ZOHO_SMTP_PORT as string, 10);
      const isSecure = port === 465; // Use secure connection for port 465 (SSL)

      this.transporter = nodemailer.createTransport({
        host: process.env.ZOHO_SMTP_HOST,
        port: port,
        secure: isSecure,
        auth: {
          user: process.env.ZOHO_SMTP_USER,
          pass: process.env.ZOHO_SMTP_PASS,
        },
      });

      this.logger.log('Zoho Mail SMTP transporter initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize Zoho Mail SMTP transporter: ${errorMessage}`);
      throw new InternalServerErrorException(
        `Failed to initialize email transporter: ${errorMessage}`,
      );
    }
  }

  /**
   * Send email via Zoho Mail SMTP
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

      this.logger.log(`Email sent successfully via Zoho Mail SMTP. Message ID: ${result.messageId}`);

      return {
        messageId: result.messageId || result.response || 'unknown',
        status: 'sent',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Zoho Mail SMTP error';
      this.logger.error(`Failed to send email via Zoho Mail SMTP: ${errorMessage}`, error);
      throw new ServiceUnavailableException(
        `Failed to send email via Zoho Mail SMTP: ${errorMessage}`,
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
      this.logger.log('Zoho Mail SMTP connection verified successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to verify Zoho Mail SMTP connection: ${errorMessage}`, error);
      return false;
    }
  }
}
