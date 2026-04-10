# Mailjet Email Provider Setup Guide

## Overview

Mailjet is a powerful, enterprise-grade email service platform designed to deliver emails reliably at scale with advanced analytics, template management, and deliverability optimization.

**Official Website:** https://www.mailjet.com

## Setup Instructions

### Step 1: Create Mailjet Account

1. Go to https://www.mailjet.com
2. Sign up for an account (free tier available)
3. Verify your email address

### Step 2: Verify Sender Email

To send emails, you must verify your sender address:

1. In Mailjet dashboard, go to **Sender addresses** or **From addresses**
2. Click **Add a sender address**
3. Enter your email address (e.g., `noreply@yourdomain.com`)
4. Check your email and click the confirmation link
5. Status will change to "Verified"

**Note:** You can use `api@mailjet.com` as a test address initially.

### Step 3: Get API Credentials

1. Navigate to **Account Settings** → **API Key Management** (or **REST API**)
2. Find your **API Key** (also called Public Key)
3. Find your **Secret Key** (also called Private Key)
4. Keep both safe - you'll need them

### Step 4: Configure Environment Variables

Add to your `.env` file:

```env
# Mailjet Configuration
MAILJET_API_KEY=your_api_key_here
MAILJET_SECRET_KEY=your_secret_key_here
MAILJET_FROM_EMAIL=noreply@yourdomain.com
MAILJET_FROM_NAME=Your App Name
```

**Variables:**
- `MAILJET_API_KEY` - Your public API key
- `MAILJET_SECRET_KEY` - Your private API key (keep secure!)
- `MAILJET_FROM_EMAIL` - Verified sender email address
- `MAILJET_FROM_NAME` - Display name (optional, defaults to "Notification")

### Step 5: Switch Provider in email.module.ts

Update [src/common/email/email.module.ts](../email.module.ts):

```typescript
{
  provide: 'IEmailProvider',
  useClass: MailjetEmailProvider,  // Switch to Mailjet
}
```

### Step 6: Test

Run your application:

```bash
npm run start:dev
```

Send a test OTP email:

```bash
curl -X POST http://localhost:3000/user/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","otp":"123456"}'
```

Check your email inbox!

---

## Mailjet API Reference

### Request Format

```typescript
POST https://api.mailjet.com/v3.1/send

Headers:
  Authorization: Basic BASE64(API_KEY:SECRET_KEY)
  Content-Type: application/json

Body:
{
  "Messages": [
    {
      "From": {
        "Email": "noreply@example.com",
        "Name": "Your App"
      },
      "To": [
        {
          "Email": "recipient@example.com"
        }
      ],
      "Subject": "Hello World",
      "TextPart": "Plain text content",
      "HTMLPart": "<h1>HTML content</h1>"
    }
  ]
}
```

### Response

**Success (200):**
```json
{
  "Messages": [
    {
      "Status": "success",
      "ID": 1234567890,
      "MessageID": 1234567890
    }
  ]
}
```

**Error (400/401):**
```json
{
  "ErrorMessage": "Invalid credentials",
  "ErrorRelatedTo": "Authentication"
}
```

---

## Mailjet vs Other Providers

| Feature | Mailjet | Mailgun | Resend | SendGrid |
|---------|---------|---------|--------|----------|
| **Setup Time** | 10 mins | 10 mins | 5 mins | 15 mins |
| **Free Tier** | 200/day | 100/month | 100/day | 100/day |
| **Price/1000** | $0.65 | $0.50 | $0.75 | $0.80 |
| **API Simplicity** | Very Good | Good | Outstanding | Good |
| **Dashboard** | Excellent | Good | Modern | Full-featured |
| **Template Engine** | Yes | Yes | No | Yes |
| **Best For** | Enterprise | High-volume | Developers | Marketing |

---

## Troubleshooting

### Issue: `MAILJET_API_KEY is not configured`

**Solution:** Make sure `.env` has the correct credentials:
```env
MAILJET_API_KEY=your_api_key
MAILJET_SECRET_KEY=your_secret_key
```

### Issue: `Invalid credentials` (401 Error)

**Solution:** 
- Verify your API key and secret key are copied correctly
- Check that spaces weren't accidentally added
- Regenerate keys if needed in Mailjet dashboard

### Issue: `Email address not verified`

**Solution:** The `MAILJET_FROM_EMAIL` must be verified in Mailjet dashboard:
- Go to Sender addresses
- Verify the email address by clicking confirmation link
- Wait a few minutes before trying again

### Issue: Emails not arriving

**Solution:** Check Mailjet dashboard → Activity/Messages to see:
- If email was sent successfully
- Delivery status and bounce reasons
- Any spam folder alerts

---

## Features of Mailjet

✅ **Contact Management** - Build and manage subscriber lists  
✅ **Email Templates** - Visual template builder  
✅ **Advanced Analytics** - Click tracking, open rates, engagement  
✅ **A/B Testing** - Test different email versions  
✅ **Automation** - Event-triggered emails  
✅ **API-First** - Easy to integrate  
✅ **SMTP Support** - Use SMTP if you prefer  
✅ **Webhooks** - Real-time notifications  

---

## Advanced: Dynamic Provider Selection

Switch providers dynamically in `email.module.ts`:

```typescript
{
  provide: 'IEmailProvider',
  useFactory: () => {
    const provider = process.env.EMAIL_PROVIDER || 'mailgun';
    
    if (provider === 'mailjet') {
      return new MailjetEmailProvider();
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
EMAIL_PROVIDER=mailjet
```

---

## Rate Limiting

Mailjet API limits:
- **Free plan:** 200 emails/day
- **Basic plan:** 1,000 emails/month
- **Pro plan:** Unlimited emails

Your provider automatically handles retries if rate-limited.

---

## Support

- **Documentation:** https://dev.mailjet.com
- **API Reference:** https://dev.mailjet.com/email/guides/send-api-for-transactional-emails/
- **Support Portal:** https://app.mailjet.com/support

---

## Next Steps

✅ Environment variables configured  
✅ Provider switched to MailjetEmailProvider  
✅ Tested with verified email address  
✅ Ready for production!
