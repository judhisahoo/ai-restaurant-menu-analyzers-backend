# MailerSend Email Provider Setup Guide (SMTP)

## Overview

MailerSend is a modern, developer-friendly email service platform. This guide covers setting up **SMTP** connections, which is a universal email protocol that works across all services.

**Official Website:** https://www.mailersend.com

## Prerequisites

Install nodemailer package (required for SMTP):

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Setup Instructions

### Step 1: Create MailerSend Account

1. Go to https://www.mailersend.com
2. Sign up for a free account
3. Verify your email address
4. Complete the onboarding

### Step 2: Verify Sender Email/Domain

To send emails, you must verify your sender domain:

1. In MailerSend dashboard, go to **Domains**
2. Click **Add a Domain** or **Add a Sender Email**
3. Enter your domain/email (e.g., `noreply@yourdomain.com`)
4. Add the DNS records shown (TXT, CNAME, MX records as needed)
5. Click **Verify** to confirm
6. Status will show as "Verified" (usually within minutes)

**For Testing:** You can use any email with your verified domain.

### Step 3: Configure SMTP Settings

**Get SMTP Credentials:**
- SMTP Host: `smtp.mailersend.com`
- SMTP Port: `587` (TLS) or `465` (SSL)
- SMTP Username: Your email or API key (check your account)
- SMTP Password: Your API key or password

1. Navigate to **Settings** → **SMTP & API**
2. Copy your SMTP credentials
3. Store them securely

### Step 4: Configure Environment Variables

Add to your `.env` file:

```env
# MailerSend SMTP Configuration
MAILERSEND_SMTP_HOST=smtp.mailersend.com
MAILERSEND_SMTP_PORT=587
MAILERSEND_SMTP_USER=your_smtp_username_or_api_key
MAILERSEND_SMTP_PASS=your_smtp_password_or_api_token
MAILERSEND_FROM_EMAIL=noreply@yourdomain.com
MAILERSEND_FROM_NAME=Your App Name
```

**Variables Explained:**
- `MAILERSEND_SMTP_HOST` - MailerSend SMTP server (always `smtp.mailersend.com`)
- `MAILERSEND_SMTP_PORT` - Port 587 (TLS) or 465 (SSL, secure)
- `MAILERSEND_SMTP_USER` - Your login username/email
- `MAILERSEND_SMTP_PASS` - Your login password/API token
- `MAILERSEND_FROM_EMAIL` - Verified sender email address
- `MAILERSEND_FROM_NAME` - Display name (optional, defaults to "Notification")

### Step 5: Switch Provider in email.module.ts

Update [src/common/email/email.module.ts](../email.module.ts):

```typescript
{
  provide: 'IEmailProvider',
  useClass: MailerSendEmailProvider,  // Switch to MailerSend SMTP
}
```

### Step 6: Test Connection

Run your application:

```bash
npm run start:dev
```

This will automatically test the SMTP connection during initialization. You should see:
```
MailerSend SMTP transporter initialized successfully
```

Send a test OTP email:

```bash
curl -X POST http://localhost:3000/user/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","otp":"123456"}'
```

Check your email inbox!

---

## SMTP Configuration Options

### Port 587 (TLS - Recommended)
```env
MAILERSEND_SMTP_PORT=587
```
- Uses STARTTLS encryption
- Started as plaintext, then upgrades to encrypted
- More compatible with most systems
- Recommended for most use cases

### Port 465 (SSL - Secure)
```env
MAILERSEND_SMTP_PORT=465
```
- Uses SSL encryption from the start
- More secure
- May have compatibility issues with some firewalls
- Alternative secure option

---

## Troubleshooting

### Issue: `MAILERSEND_SMTP_HOST is not configured`

**Solution:** Make sure `.env` has all SMTP variables:
```env
MAILERSEND_SMTP_HOST=smtp.mailersend.com
MAILERSEND_SMTP_PORT=587
MAILERSEND_SMTP_USER=your_username
MAILERSEND_SMTP_PASS=your_password
```

### Issue: `Authentication failed` (535 Error)

**Solution:** 
- Verify credentials are correct
- Check username/password are properly URL-encoded if they contain special characters
- Ensure the account has SMTP access enabled
- Try regenerating API key in MailerSend dashboard

### Issue: `Connection refused` or `Network error`

**Solution:**
- Verify `MAILERSEND_SMTP_HOST` is correct: `smtp.mailersend.com`
- Check `MAILERSEND_SMTP_PORT` is 587 or 465
- Verify firewall/ISP isn't blocking SMTP ports (common issue)
- Check network connectivity: `ping smtp.mailersend.com`

### Issue: `Email address not verified`

**Solution:** The `MAILERSEND_FROM_EMAIL` must be verified:
- Go to Domains or Sender Emails in dashboard
- Add and verify the domain with DNS records
- Wait for verification (usually instant to 5 minutes)
- Try a different domain if having issues

### Issue: `Failed to initialize email transporter`

**Solution:**
- Ensure nodemailer is installed: `npm install nodemailer`
- Check all SMTP config variables are set
- Verify no typos in environment variable names
- Check logs for specific error message

### Issue: Emails not arriving in inbox

**Solution:** Check MailerSend Activity log:
- Dashboard → **Activity** or **Email Log**
- See if email was sent/delivered
- Check for delivery status and bounce reasons
- Verify recipient domain isn't blocking emails

---

## SMTP vs REST API

| Feature | SMTP | REST API |
|---------|------|----------|
| **Dependencies** | nodemailer | fetch (built-in) |
| **Setup Time** | 10 mins | 5 mins |
| **Universal** | Yes (any provider) | Provider-specific |
| **Flexibility** | Less (standardized) | More (custom headers, etc) |
| **Reliability** | Excellent | Very Good |
| **Best For** | Any application | Fast integration |

**Why SMTP?**
- Works with any email provider
- Standardized protocol
- No need to learn provider-specific APIs
- More universal across systems

---

## Advanced: Dynamic Provider Selection

Switch providers dynamically in `email.module.ts`:

```typescript
{
  provide: 'IEmailProvider',
  useFactory: () => {
    const provider = process.env.EMAIL_PROVIDER || 'mailgun';
    
    if (provider === 'mailersend') {
      return new MailerSendEmailProvider();
    }
    if (provider === 'resend') {
      return new ResendEmailProvider();
    }
    return new MailgunEmailProvider();
  },
}
```

Then set in `.env`:
```env
EMAIL_PROVIDER=mailersend
```

---

## Connection Pooling for High Volume

For high-volume applications, you can enable connection pooling in nodemailer. Edit the provider's `initializeTransporter()` method:

```typescript
pool: {
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5
}
```

---

## Support & Resources

- **Documentation:** https://www.mailersend.com/help
- **SMTP Guide:** https://www.mailersend.com/help/set-up-smtp
- **Status Page:** https://status.mailersend.com
- **Support:** support@mailersend.com
- **Nodemailer Docs:** https://nodemailer.com

---

## Next Steps

✅ nodemailer installed  
✅ SMTP credentials configured  
✅ Provider switched to MailerSendEmailProvider (SMTP mode)  
✅ Connection tested during startup  
✅ Ready for production!

### Keep Monitoring
- Watch SMTP connection stability
- Monitor bounce rates
- Review email activity in dashboard
- Adjust connection pooling for performance
