# Email Service - Quick Reference Guide

## What Changed?

**Before:** Mailgun code was scattered in `user.service.ts`
**After:** Clean, professional architecture with pluggable email providers

## After Refactoring - File Structure

```
src/
├── common/
│   └── email/
│       ├── interfaces/
│       │   └── email-provider.interface.ts
│       ├── providers/
│       │   ├── mailgun-email.provider.ts (currently active)
│       │   ├── resend-email.provider.ts (ready to use)
│       │   ├── mailjet-email.provider.ts (ready to use)
│       │   ├── mailersend-email.provider.ts (ready to use)
│       │   └── sendgrid-email.provider.example.ts (template)
│       ├── email.service.ts
│       ├── email.module.ts
│       ├── README.md
│       ├── RESEND_SETUP.md
│       ├── MAILJET_SETUP.md
│       └── MAILERSEND_SETUP.md
├── user/
│   ├── user.service.ts (cleaned up!)
│   ├── user.module.ts (updated)
│   └── ...
└── app.module.ts (updated)
```

## How to Use

In any service, inject `EmailService` and call domain-specific methods:

```typescript
import { EmailService } from '../common/email/email.service';

@Injectable()
export class UserService {
  constructor(private readonly emailService: EmailService) {}

  async sendOtp(email: string, otp: string) {
    // That's it! No Mailgun code needed
    await this.emailService.sendOtp(email, otp);
  }

  async welcomeNewUser(email: string, name: string) {
    await this.emailService.sendWelcome(email, name);
  }
}
```

## Available Email Providers

### Currently Implemented

#### 1. **Mailgun** (Currently Active)
- Config: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`
- Setup time: ~10 mins
- Switch: Already configured by default

#### 2. **Resend** (Ready to Use)
- Config: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Setup time: ~5 mins (fastest!)
- Setup guide: See [RESEND_SETUP.md](src/common/email/RESEND_SETUP.md)
- Switch: Change `useClass: MailgunEmailProvider` to `useClass: ResendEmailProvider` in `email.module.ts`

#### 3. **Mailjet** (Ready to Use)
- Config: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL`
- Setup time: ~10 mins
- Setup guide: See [MAILJET_SETUP.md](src/common/email/MAILJET_SETUP.md)
- Switch: Change `useClass: MailgunEmailProvider` to `useClass: MailjetEmailProvider` in `email.module.ts`

#### 4. **MailerSend** (Ready to Use - SMTP)
- Config: `MAILERSEND_SMTP_HOST`, `MAILERSEND_SMTP_PORT`, `MAILERSEND_SMTP_USER`, `MAILERSEND_SMTP_PASS` (SMTP protocol)
- Setup time: ~10 mins (requires nodemailer)
- Setup guide: See [MAILERSEND_SETUP.md](src/common/email/MAILERSEND_SETUP.md)
- Switch: Change `useClass: MailgunEmailProvider` to `useClass: MailerSendEmailProvider` in `email.module.ts`
- Note: Install nodejs dependency first: `npm install nodemailer @types/nodemailer`

### Switching to Resend

**Step 1:** Add environment variables to `.env`:
```env
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Step 2:** Update `src/common/email/email.module.ts`:
```typescript
import { ResendEmailProvider } from './providers/resend-email.provider';

{
  provide: 'IEmailProvider',
  useClass: ResendEmailProvider,  // Switch from MailgunEmailProvider
}
```

**Done!** All services automatically use Resend. No other code changes needed.

### Switching to Mailjet

**Step 1:** Add environment variables to `.env`:
```env
MAILJET_API_KEY=your_api_key
MAILJET_SECRET_KEY=your_secret_key
MAILJET_FROM_EMAIL=noreply@yourdomain.com
```

**Step 2:** Update `src/common/email/email.module.ts`:
```typescript
import { MailjetEmailProvider } from './providers/mailjet-email.provider';

{
  provide: 'IEmailProvider',
  useClass: MailjetEmailProvider,  // Switch from MailgunEmailProvider
}
```

**Done!** All services automatically use Mailjet. No other code changes needed.

### Switching to MailerSend (SMTP)

**Step 1:** Install nodemailer package:
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

**Step 2:** Add environment variables to `.env`:
```env
MAILERSEND_SMTP_HOST=smtp.mailersend.com
MAILERSEND_SMTP_PORT=587
MAILERSEND_SMTP_USER=your_smtp_username
MAILERSEND_SMTP_PASS=your_smtp_password_or_api_key
MAILERSEND_FROM_EMAIL=noreply@yourdomain.com
MAILERSEND_FROM_NAME=Your App Name
```

**Step 3:** Update `src/common/email/email.module.ts`:
```typescript
import { MailerSendEmailProvider } from './providers/mailersend-email.provider';

{
  provide: 'IEmailProvider',
  useClass: MailerSendEmailProvider,  // Switch from MailgunEmailProvider
}
```

**Done!** All services automatically use MailerSend SMTP. No other code changes needed.

### Adding SendGrid or Other Providers

### Step 1: Copy the Example
```
sendgrid-email.provider.example.ts → sendgrid-email.provider.ts
```

### Step 2: Update email.module.ts
```typescript
import { SendgridEmailProvider } from './providers/sendgrid-email.provider';

@Module({
  providers: [
    MailgunEmailProvider,
    ResendEmailProvider,
    MailjetEmailProvider,
    MailerSendEmailProvider,
    SendgridEmailProvider,  // Add this
    // ...
  ],
  // ...
})
```

### Step 3: Change the Provider
```typescript
{
  provide: 'IEmailProvider',
  useClass: SendgridEmailProvider,  // Switch to SendGrid
}
```

### Step 4: Add Environment Variables
```env
SENDGRID_API_KEY=your_api_key
SENDGRID_FROM_EMAIL=noreply@example.com
```

**Done!** No other code changes needed. All services automatically use SendGrid.

## Adding New Email Types

Edit `src/common/email/email.service.ts`:

```typescript
async sendPasswordReset(email: string, resetToken: string) {
  return this.emailProvider.send({
    to: email,
    subject: 'Reset Your Password',
    text: `Click to reset: https://app.com/reset?token=${resetToken}`,
    html: `<a href="https://app.com/reset?token=${resetToken}">Reset Password</a>`,
  });
}
```

Then use anywhere:
```typescript
await this.emailService.sendPasswordReset(user.email, token);
```

## Available Methods in EmailService

- `sendOtp(email, otp)` - Send one-time password
- `sendWelcome(email, userName?)` - Send welcome email
- `sendCustom(payload)` - Send any custom email

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Lines of code in sendOtp | 70+ | 5 |
| Adding new provider | Requires modifying user.service.ts | Just create new provider class |
| Testing | Difficult (Mailgun API calls) | Easy (mock provider) |
| Code maintainability | Poor | Excellent |
| Professional pattern | No | Yes (Strategy + DI) |

## Next Steps

1. ✅ Refactoring complete
2. Run tests to ensure everything works
3. **NEW:** ✨ Try **Resend provider** (fastest setup, only 2 steps):
   - Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `.env`
   - Change `useClass` to `ResendEmailProvider` in `email.module.ts`
   - See [RESEND_SETUP.md](src/common/email/RESEND_SETUP.md) for detailed guide
4. (Optional) Copy and customize `sendgrid-email.provider.example.ts` for SendGrid
5. Document any custom email methods you add

---

**Provider Quick Links:**
- 📧 [Resend Setup Guide](src/common/email/RESEND_SETUP.md) - Fastest! (5 mins)
- 📨 [Mailjet Setup Guide](src/common/email/MAILJET_SETUP.md) - Enterprise-ready (10 mins)
- � [MailerSend Setup Guide](src/common/email/MAILERSEND_SETUP.md) - Free tier friendly (5-10 mins)
- �📚 [Architecture Details](src/common/email/README.md)
- 🏗️ SendGrid Example: `src/common/email/providers/sendgrid-email.provider.example.ts`
