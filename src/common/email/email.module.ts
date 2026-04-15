import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailgunEmailProvider } from './providers/mailgun-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { MailjetEmailProvider } from './providers/mailjet-email.provider';
import { MailerSendEmailProvider } from './providers/mailersend-email.provider';
import { ZohoEmailProvider } from './providers/zoho-email.provider';
import { GmailEmailProvider } from './providers/gmail-email.provider';
import { IEmailProvider } from './interfaces/email-provider.interface';

/**
 * Email Module
 * Provides email functionality with extensible provider pattern.
 * To add a new provider:
 * 1. Create a new provider class implementing IEmailProvider
 * 2. Add it to the providers array
 * 3. Update the useClass in the inject section
 * 
 * Current Providers:
 *   - MailgunEmailProvider (MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL)
 *   - ResendEmailProvider (RESEND_API_KEY, RESEND_FROM_EMAIL)
 *   - MailjetEmailProvider (MAILJET_API_KEY, MAILJET_SECRET_KEY, MAILJET_FROM_EMAIL)
 *   - MailerSendEmailProvider (SMTP: MAILERSEND_SMTP_HOST, MAILERSEND_SMTP_PORT, MAILERSEND_SMTP_USER, MAILERSEND_SMTP_PASS, MAILERSEND_FROM_EMAIL)
 *   - ZohoEmailProvider (SMTP: ZOHO_SMTP_HOST, ZOHO_SMTP_PORT, ZOHO_SMTP_USER, ZOHO_SMTP_PASS, ZOHO_FROM_EMAIL)
 *   - GmailEmailProvider (GMAIL_EMAIL, GMAIL_APP_PASSWORD, GMAIL_FROM_NAME - optional)
 * 
 * Example to switch providers:
 *   useClass: ResendEmailProvider
 *   useClass: MailjetEmailProvider
 *   useClass: MailerSendEmailProvider
 *   useClass: ZohoEmailProvider
 *   useClass: GmailEmailProvider
 * 
 * Example to add SendGrid:
 *   1. Create SendgridEmailProvider in providers/
 *   2. Add to providers array
 *   3. useClass: SendgridEmailProvider
 */
@Module({
  providers: [
    //MailgunEmailProvider,
    //ResendEmailProvider,
    //MailjetEmailProvider,
    //MailerSendEmailProvider,
    //ZohoEmailProvider,
    GmailEmailProvider,
    EmailService,
    {
      provide: 'IEmailProvider',
      //useClass: MailgunEmailProvider,
      // To switch providers, change useClass to:
      // useClass: ResendEmailProvider,
      // useClass: MailjetEmailProvider,
      // useClass: MailerSendEmailProvider,
      //useClass: ZohoEmailProvider,
      useClass: GmailEmailProvider,
    },
    {
      provide: EmailService,
      useFactory: (emailProvider: IEmailProvider) => new EmailService(emailProvider),
      inject: ['IEmailProvider'],
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
