# Gmail Email Provider Setup Guide

This guide will help you configure Gmail as your email provider in the NestJS application.

## Prerequisites

- A Gmail account
- 2-Step Verification enabled on your Gmail account

## Step-by-Step Setup

### 1. Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/security
2. Find "2-Step Verification" section
3. Click on it and follow the prompts to enable it
4. You may need to verify your identity using your phone

### 2. Generate an App Password

1. Go to: https://myaccount.google.com/apppasswords
2. You may need to sign in again
3. Select **Mail** from the dropdown for "Select the app"
4. Select **Windows Computer** (or whichever device type you're using)
5. Google will generate a 16-character password like: `xxxx xxxx xxxx xxxx`
6. **Copy this password** (you'll need it in the next step)

### 3. Configure Environment Variables

1. Open your `.env` file in the project root
2. Uncomment and update the Gmail configuration section:

```env
GMAIL_EMAIL="your-email@gmail.com"
GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
GMAIL_FROM_NAME="Your App Name"
```

Replace:
- `your-email@gmail.com` with your actual Gmail address
- `xxxx xxxx xxxx xxxx` with the 16-character app password you generated
- `Your App Name` with your application name (this will appear in the "From" field)

### 4. Switch the Email Provider

1. Open `src/common/email/email.module.ts`
2. Find the line: `useClass: MailgunEmailProvider,`
3. Change it to: `useClass: GmailEmailProvider,`
4. Uncomment `GmailEmailProvider` in the providers array if needed

Example:
```typescript
@Module({
  providers: [
    MailgunEmailProvider,
    //ResendEmailProvider,
    //MailjetEmailProvider,
    //MailerSendEmailProvider,
    //ZohoEmailProvider,
    GmailEmailProvider,  // ← Uncomment this
    EmailService,
    {
      provide: 'IEmailProvider',
      useClass: GmailEmailProvider,  // ← Change this from MailgunEmailProvider
      // To switch providers, change useClass to:
      // useClass: ResendEmailProvider,
      // useClass: MailjetEmailProvider,
      // useClass: MailerSendEmailProvider,
      //useClass: ZohoEmailProvider,
    },
    // ... rest of the module
  ],
  exports: [EmailService],
})
export class EmailModule {}
```

### 5. Test the Gmail Provider (Optional)

Create a simple test route or use your existing email endpoints to verify:

```typescript
await this.emailService.sendOtp('test@example.com', '123456');
```

You should receive the email from your Gmail address!

## Common Issues and Solutions

### Issue: "Failed to send email: Invalid login"
- **Solution**: Double-check that GMAIL_APP_PASSWORD is correct (16 characters with spaces)
- Make sure you used the generated app password, NOT your regular Gmail password
- Verify that 2-Step Verification is enabled on your account

### Issue: "Gmail service error"
- **Solution**: Make sure GMAIL_EMAIL is set correctly to your Gmail address
- Ensure your Gmail account has IMAP access enabled (usually enabled by default)

### Issue: "GMAIL_EMAIL is not configured"
- **Solution**: Make sure you've uncommented and set the GMAIL_EMAIL in your .env file
- Restart your dev server after modifying .env

## Security Best Practices

⚠️ **Warning**: Never commit your `.env` file with actual credentials to version control!

1. Use a `.gitignore` file to exclude `.env`:
```
.env
.env.local
.env.*.local
```

2. For production:
   - Store credentials in environment variables or a secrets manager
   - Consider using OAuth2 with service accounts for higher security
   - Never hardcode credentials in your code

## Switching Back to Another Provider

To switch back to a different email provider:

1. Open `src/common/email/email.module.ts`
2. Change `useClass: GmailEmailProvider,` to your desired provider (e.g., `useClass: MailgunEmailProvider,`)
3. Restart your dev server

## Available Email Providers

This application supports multiple email providers:
- **MailgunEmailProvider** - Using Mailgun API
- **ResendEmailProvider** - Using Resend service
- **MailjetEmailProvider** - Using Mailjet API
- **MailerSendEmailProvider** - Using MailerSend SMTP
- **ZohoEmailProvider** - Using Zoho Mail SMTP
- **GmailEmailProvider** - Using Gmail SMTP (newly added)

Refer to the setup guides in the email providers directory for detailed configuration of other providers.

## Additional Resources

- [Gmail App Passwords Help](https://support.google.com/accounts/answer/185833)
- [Nodemailer Gmail Documentation](https://nodemailer.com/smtp/gmail/)
- [2-Step Verification Setup](https://support.google.com/accounts/answer/185839)
