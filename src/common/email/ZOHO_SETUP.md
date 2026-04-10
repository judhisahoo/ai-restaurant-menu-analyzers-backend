# Zoho Mail SMTP Setup Guide

This guide will help you configure the Zoho Mail SMTP email provider for your NestJS application.

## Overview

Zoho Mail is a secure, privacy-focused email service that offers reliable SMTP connectivity. It's ideal for businesses looking for a secure alternative to Gmail or other cloud email providers.

**Provider Class**: `ZohoEmailProvider`
**Protocol**: SMTP (via nodemailer)
**Documentation**: https://www.zoho.com/mail

## Prerequisites

- Zoho Mail account (free or paid)
- Access to Zoho Mail account settings
- nodemailer package installed: `npm install nodemailer @types/nodemailer`

## Step 1: Create/Access Your Zoho Mail Account

1. Go to [Zoho Mail](https://www.zoho.com/mail)
2. Sign up for a free account or log in to your existing account
3. Set up your email address (if not already done)

## Step 2: Enable SMTP and Get Credentials

### For Zoho Mail Accounts:

1. Log in to your Zoho Mail account
2. Click on your profile icon (top right) → **Settings**
3. Go to **Apps** or **Connected Apps** section
4. Look for **SMTP** or **Mail Accounts**
5. Enable SMTP access if prompted
6. Note your credentials:
   - **SMTP Server**: `smtp.zoho.com` (or region-specific)
   - **Port**: `587` (TLS) or `465` (SSL)
   - **Username**: Your full email address (e.g., `youremail@yourdomain.com`)
   - **Password**: Your Zoho Mail password

### For Enhanced Security (Recommended):

1. Generate an **app-specific password** in Zoho Mail settings:
   - Go to Settings → Security
   - Look for "App Passwords" or "Generate Password"
   - Generate a new app password for "Email"
   - Use this password instead of your account password

### Region-Specific SMTP Servers:

- **US/Global**: `smtp.zoho.com`
- **EU**: `smtp.zoho.eu`
- **India**: `smtp.zoho.in`
- **Other regions**: Check Zoho Mail documentation

## Step 3: Configure Environment Variables

Add the following to your `.env` file:

```env
# Zoho Mail SMTP Configuration
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
ZOHO_SMTP_USER=your-email@yourdomain.com
ZOHO_SMTP_PASS=your-app-password-or-account-password
ZOHO_FROM_EMAIL=your-email@yourdomain.com
ZOHO_FROM_NAME=Your Application Name
```

### Environment Variables Reference:

| Variable | Description | Example |
|----------|-------------|---------|
| `ZOHO_SMTP_HOST` | Zoho Mail SMTP server | `smtp.zoho.com` |
| `ZOHO_SMTP_PORT` | SMTP port (587 for TLS, 465 for SSL) | `587` |
| `ZOHO_SMTP_USER` | Your Zoho Mail email address | `noreply@company.com` |
| `ZOHO_SMTP_PASS` | Your password or app-specific password | `your-secure-password` |
| `ZOHO_FROM_EMAIL` | From email (must be your Zoho Mail email) | `noreply@company.com` |
| `ZOHO_FROM_NAME` | Display name for sent emails | `My App Notifications` |

**Important**: 
- `ZOHO_SMTP_USER` and `ZOHO_FROM_EMAIL` should be the same Zoho Mail email address
- Use app-specific passwords for better security
- Keep credentials secure; never commit `.env` to version control

## Step 4: Activate the Zoho Provider

Edit `src/common/email/email.module.ts` and change the `useClass` to use Zoho:

```typescript
{
  provide: 'IEmailProvider',
  useClass: ZohoEmailProvider,  // Change from MailerSendEmailProvider
}
```

## Step 5: Test the Provider

### Option 1: Via Application

Trigger an OTP or email operation in your app:

```bash
# Example: Send OTP to a test email
POST /api/user/send-otp
Content-Type: application/json

{
  "email": "test@example.com"
}
```

### Option 2: Via Direct API Call

You can create a test endpoint:

```typescript
import { Controller, Get } from '@nestjs/common';
import { EmailService } from './common/email/email.service';

@Controller('test')
export class TestController {
  constructor(private emailService: EmailService) {}

  @Get('send-email')
  async testEmail() {
    return await this.emailService.sendOtp({
      to: 'test@example.com',
      userName: 'Test User',
      otp: '123456',
      expiresIn: '10 minutes',
    });
  }
}
```

## Troubleshooting

### Error: "Authentication failed"
- **Cause**: Incorrect email or password
- **Solution**: 
  - Verify your Zoho Mail email address (check for typos, spaces)
  - Use an app-specific password instead of account password
  - Confirm SMTP is enabled in your Zoho Mail settings

### Error: "Connection refused" or "Connection timeout"
- **Cause**: Firewall or network blocking SMTP
- **Solution**:
  - Check if port 587 or 465 is blocked by your ISP/firewall
  - Try the other port (587 → 465 or vice versa)
  - If on corporate network, contact IT support
  - Verify `ZOHO_SMTP_HOST` is correct for your region

### Error: "TLS/SSL not supported"
- **Cause**: SMTP port mismatch
- **Solution**:
  - Use port `587` with TLS enabled
  - Or use port `465` with SSL enabled
  - The provider automatically handles this based on port

### Emails not sent but no errors
- **Cause**: Email catching enabled or development mode
- **Solution**:
  - Check application logs for detailed error messages
  - Verify environment variables are loaded correctly
  - Check Zoho Mail Activity log for blocked attempts

### "From email mismatch" error
- **Cause**: `ZOHO_FROM_EMAIL` doesn't match your verified Zoho Mail address
- **Solution**:
  - Ensure `ZOHO_FROM_EMAIL` is exactly the same as your Zoho Mail account
  - If using subdomains, verify they're properly configured in Zoho Mail

## SMTP Port Selection

### Port 587 (TLS) - Recommended for most cases
```env
ZOHO_SMTP_PORT=587
```
- Modern standard
- Upgrades connection to TLS
- Less likely to be blocked

### Port 465 (SSL) - Alternative
```env
ZOHO_SMTP_PORT=465
```
- Legacy but secure
- SSL from the start
- Use if port 587 doesn't work

The provider automatically sets `secure: true` for port 465 and `secure: false` for port 587.

## Performance & Best Practices

1. **Use App-Specific Passwords**: Creates additional security layer
2. **Connection Pooling**: Zoho Mail supports connection pooling (configured in nodemailer)
3. **Batch Sending**: For bulk emails, consider rate limits from Zoho Mail
4. **Monitor Logs**: Check your application logs for SMTP errors
5. **Test Periodically**: Verify connectivity with test emails

## Switching Between Providers

To switch to a different email provider, simply change the `useClass` in `src/common/email/email.module.ts`:

```typescript
// To use MailerSend
useClass: MailerSendEmailProvider,

// To use Resend
useClass: ResendEmailProvider,

// To use Mailjet
useClass: MailjetEmailProvider,

// To use Mailgun
useClass: MailgunEmailProvider,

// To use Zoho Mail
useClass: ZohoEmailProvider,
```

## Additional Resources

- [Zoho Mail Official Documentation](https://www.zoho.com/mail/)
- [Zoho Mail SMTP Configuration](https://www.zoho.com/mail/help/zoho-mail-smtp-configuration.html)
- [nodemailer Documentation](https://nodemailer.com/)
- [SMTP Port Selection Guide](https://www.mailgun.com/blog/email/25-587-465-smtp-port-guide/)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review your Zoho Mail account security settings
3. Verify environment variables are correctly set
4. Check application logs for specific error messages
5. Contact Zoho Mail support via their official channels
