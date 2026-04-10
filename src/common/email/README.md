# Email Service Architecture

This is a professional, extensible email service system using the **Strategy Pattern** for managing multiple email providers.

## Current Structure

```
src/common/email/
├── interfaces/
│   └── email-provider.interface.ts      # IEmailProvider contract
├── providers/
│   ├── mailgun-email.provider.ts        # Mailgun implementation
│   ├── resend-email.provider.ts         # Resend implementation
│   ├── mailjet-email.provider.ts        # Mailjet implementation
│   ├── mailersend-email.provider.ts     # MailerSend implementation
│   ├── zoho-email.provider.ts           # Zoho Mail implementation
│   └── sendgrid-email.provider.example.ts  # SendGrid template
├── email.service.ts                     # High-level email service
├── email.module.ts                      # NestJS module
├── README.md                            # This file
├── RESEND_SETUP.md                      # Resend setup guide
├── MAILJET_SETUP.md                     # Mailjet setup guide
├── MAILERSEND_SETUP.md                  # MailerSend setup guide
└── ZOHO_SETUP.md                        # Zoho Mail setup guide
```

## Architecture Overview

### 1. **IEmailProvider Interface**
All email providers must implement this interface:

```typescript
export interface IEmailProvider {
  send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }>;
}
```

### 2. **Email Providers**
Each provider handles specific email service logic (Mailgun, SendGrid, AWS SES, etc.)

### 3. **EmailService**
High-level service providing domain-specific methods like `sendOtp()`, `sendWelcome()`, etc.

### 4. **EmailModule**
NestJS module that registers the provider and provides the service to other modules.

---

## Usage Example

In any service that needs to send emails:

```typescript
import { EmailService } from '../common/email/email.service';

@Injectable()
export class UserService {
  constructor(private readonly emailService: EmailService) {}

  async sendOtp(email: string, otp: string) {
    await this.emailService.sendOtp(email, otp);
  }

  async sendWelcome(email: string, userName: string) {
    await this.emailService.sendWelcome(email, userName);
  }
}
```

---

## How to Add a New Email Provider

### Step 1: Create the Provider Class

Create a new file: `src/common/email/providers/sendgrid-email.provider.ts`

```typescript
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

@Injectable()
export class SendgridEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(SendgridEmailProvider.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('SENDGRID_API_KEY environment variable is not configured');
    }
  }

  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    const { to, subject, text, html } = payload;

    try {
      // SendGrid API implementation here
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.SENDGRID_FROM_EMAIL },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`SendGrid API error: ${response.status}`);
      }

      const messageId = response.headers.get('x-message-id');
      this.logger.log(`Email sent via SendGrid. Message ID: ${messageId}`);

      return { messageId: messageId || 'unknown', status: 'sent' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email via SendGrid: ${errorMessage}`);
      throw new ServiceUnavailableException(`Failed to send email: ${errorMessage}`);
    }
  }
}
```

### Step 2: Update EmailModule

Update `src/common/email/email.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailgunEmailProvider } from './providers/mailgun-email.provider';
import { SendgridEmailProvider } from './providers/sendgrid-email.provider';
import { IEmailProvider } from './interfaces/email-provider.interface';

@Module({
  providers: [
    MailgunEmailProvider,
    SendgridEmailProvider,
    EmailService,
    {
      provide: 'IEmailProvider',
      // Switch provider by commenting/uncommenting:
      useClass: MailgunEmailProvider,
      // useClass: SendgridEmailProvider,
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
```

### Step 3: Switch Between Providers

To use SendGrid instead of Mailgun:

```typescript
{
  provide: 'IEmailProvider',
  useClass: SendgridEmailProvider,  // Change this line
}
```

### Step 4: Add Configuration Variables

Add environment variables to `.env`:

```env
SENDGRID_API_KEY=your_api_key
SENDGRID_FROM_EMAIL=noreply@example.com
```

---

## Dynamic Provider Selection

For more advanced scenarios, use a factory to dynamically select providers:

```typescript
{
  provide: 'IEmailProvider',
  useFactory: () => {
    const provider = process.env.EMAIL_PROVIDER || 'mailgun';
    
    if (provider === 'sendgrid') {
      return new SendgridEmailProvider();
    }
    return new MailgunEmailProvider();
  },
}
```

Set in environment:
```env
EMAIL_PROVIDER=sendgrid  # or 'mailgun'
```

---

## Adding Domain-Specific Methods

Add new email types to `EmailService`:

```typescript
async sendPasswordReset(email: string, resetLink: string): Promise<...> {
  const payload: SendEmailPayload = {
    to: email,
    subject: 'Reset Your Password',
    text: `Click here to reset: ${resetLink}`,
    html: `<a href="${resetLink}">Reset Password</a>`,
  };
  
  return this.emailProvider.send(payload);
}
```

Then use in any service:
```typescript
await this.emailService.sendPasswordReset(user.email, resetLink);
```

---

## Benefits of This Architecture

✅ **Decoupling**: No service directly depends on Mailgun  
✅ **Testability**: Easy to mock the provider for unit tests  
✅ **Extensibility**: Add new providers without touching existing code  
✅ **Maintainability**: Email logic is centralized and organized  
✅ **Professional**: Follows SOLID principles and NestJS best practices  
✅ **Type-Safe**: Full TypeScript support with interfaces  

---

## Testing with Mock Provider

Create a mock provider for testing:

```typescript
// src/common/email/providers/mock-email.provider.ts
import { Injectable } from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from '../interfaces/email-provider.interface';

@Injectable()
export class MockEmailProvider implements IEmailProvider {
  async send(payload: SendEmailPayload): Promise<{ messageId: string; status: string }> {
    console.log('Mock email sent:', payload);
    return { messageId: 'mock-id', status: 'sent' };
  }
}
```

Use in test module:
```typescript
{
  provide: 'IEmailProvider',
  useClass: MockEmailProvider,
}
```

---

## Currently Implemented Providers

| Provider | Status | Config Guide | Setup Time |
|----------|--------|--------------|------------|
| **Mailgun** | ✅ Active | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL` | 10 mins |
| **Resend** | ✅ Active | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | 5 mins | 
| **Mailjet** | ✅ Active | `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL` | 10 mins |
| **MailerSend** | ✅ Active | `MAILERSEND_SMTP_HOST`, `MAILERSEND_SMTP_PORT`, `MAILERSEND_SMTP_USER`, `MAILERSEND_SMTP_PASS` (SMTP) | 10 mins |
| **Zoho Mail** | ✅ Active | `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASS` (SMTP) | 10 mins |
| **SendGrid** | 📋 Template | See `sendgrid-email.provider.example.ts` | 15 mins |

### Quick Switch Between Providers

Edit `email.module.ts`:
```typescript
{
  provide: 'IEmailProvider',
  // Switch to any provider:
  useClass: MailgunEmailProvider,      // Mailgun (REST API)
  // useClass: ResendEmailProvider,    // Resend (REST API)
  // useClass: MailjetEmailProvider,   // Mailjet (REST API)
  // useClass: MailerSendEmailProvider, // MailerSend (SMTP)
  // useClass: ZohoEmailProvider,      // Zoho Mail (SMTP)
}
```

### Setup Guides
- See [RESEND_SETUP.md](RESEND_SETUP.md) for Resend detailed instructions
- See [MAILJET_SETUP.md](MAILJET_SETUP.md) for Mailjet detailed instructions
- See [MAILERSEND_SETUP.md](MAILERSEND_SETUP.md) for MailerSend detailed instructions
- See [ZOHO_SETUP.md](ZOHO_SETUP.md) for Zoho Mail detailed instructions

---

## Other Supported Provider Templates

To add any new provider, implement the `IEmailProvider` interface. Examples:

- **AWS SES** - Amazon Simple Email Service
- **Brevo** (formerly Sendinblue)
- **Postmark** - Transactional email service
- **SparkPost** - Email delivery service
- **SendPulse** - Multi-channel marketing platform
- **Firebase Cloud Messaging** - For push notifications
- **Custom SMTP** - Self-hosted mail server

All follow the same pattern!
