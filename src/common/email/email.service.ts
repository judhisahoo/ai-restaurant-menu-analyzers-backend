import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from './interfaces/email-provider.interface';

/**
 * Email Service
 * High-level service that abstracts email sending logic
 * Works with any provider that implements IEmailProvider
 * 
 * Example:
 *   await emailService.sendOtp(email, otp);
 *   await emailService.sendWelcome(email, userName);
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailProvider: IEmailProvider) {}

  /**
   * Send OTP email to user
   * @param email Recipient email address
   * @param otp One-time password to send
   */
  async sendOtp(email: string, otp: string): Promise<{ messageId: string; status: string }> {
    const payload: SendEmailPayload = {
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
      html: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
    };

    this.logger.log(`Sending OTP email to ${email}`);
    return this.emailProvider.send(payload);
  }

  /**
   * Send welcome email to new user
   * @param email Recipient email address
   * @param userName User's name (optional)
   */
  async sendWelcome(email: string, userName?: string): Promise<{ messageId: string; status: string }> {
    const name = userName ? `${userName}!` : 'there!';
    const payload: SendEmailPayload = {
      to: email,
      subject: 'Welcome to Our Application',
      text: `Welcome ${name}\n\nThank you for registering.`,
      html: `<p>Welcome <strong>${name}</strong></p><p>Thank you for registering.</p>`,
    };

    this.logger.log(`Sending welcome email to ${email}`);
    return this.emailProvider.send(payload);
  }

  /**
   * Send a custom email using the underlying provider
   * @param payload Email payload containing to, subject, text, and html
   */
  async sendCustom(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    this.logger.log(`Sending custom email to ${payload.to}`);
    return this.emailProvider.send(payload);
  }
}
