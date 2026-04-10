# Resend Email Provider Setup Guide

## Overview

Resend is a modern email service built specifically for developers. It's simple, reliable, and optimized for transactional emails with built-in analytics and endpoint testing.

**Official Website:** https://resend.com

## Setup Instructions

### Step 1: Create Resend Account

1. Go to https://resend.com
2. Sign up for a free account
3. Verify your email address

### Step 2: Verify Domain (Recommended)

To send from a custom domain (e.g., `noreply@yourdomain.com`):

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain name
4. Add the DNS records shown (TXT, MX, CNAME)
5. Wait for verification (usually 5-30 minutes)

**For Testing:** You can use `onboarding@resend.dev` temporarily without domain verification.

### Step 3: Get API Key

1. Navigate to **API Keys** in your Resend dashboard
2. Click **Create API Key**
3. Copy the key (starts with `re_`)

### Step 4: Configure Environment Variables

Add to your `.env` file:

```env
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Note:** The email address must be verified in Resend (either from your domain or use `onboarding@resend.dev`)

### Step 5: Switch Provider in email.module.ts

**Option A:** Hard-coded switch (for production use):

```typescript
// In email.module.ts
import { ResendEmailProvider } from './providers/resend-email.provider';

{
  provide: 'IEmailProvider',
  useClass: ResendEmailProvider,  // Switch to Resend
}
```

**Option B:** Dynamic switch (recommended for development):

```typescript
// In email.module.ts
{
  provide: 'IEmailProvider',
  useFactory: () => {
    const provider = process.env.EMAIL_PROVIDER || 'mailgun';
    
    if (provider === 'resend') {
      return new ResendEmailProvider();
    }
    return new MailgunEmailProvider();
  },
}
```

Then set in `.env`:
```env
EMAIL_PROVIDER=resend
```

### Step 6: Test

Run your application:

```bash
npm run start:dev
```

Send a test OTP email to verify it works:

```bash
curl -X POST http://localhost:3000/user/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","otp":"123456"}'
```

Check your email inbox!

---

## Resend API Reference

### Request Format

```typescript
POST https://api.resend.com/emails

Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "from": "onboarding@resend.dev",
  "to": "delivered@resend.dev",
  "subject": "Hello World",
  "html": "<strong>It works!</strong>",
  "text": "It works!",
  "reply_to": "reply@example.com"
}
```

### Response

**Success (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "from": "onboarding@resend.dev",
  "to": "delivered@resend.dev",
  "created_at": "2024-04-09T10:30:00Z"
}
```

**Error (400/422):**
```json
{
  "message": "Invalid from email address"
}
```

---

## Resend vs Mailgun vs SendGrid

| Feature | Resend | Mailgun | SendGrid |
|---------|--------|---------|----------|
| **Setup Time** | 5 mins | 10 mins | 15 mins |
| **Free Tier** | 100/day | 100/month | 100/day |
| **Price/1000** | $0.75 | $0.50 | $0.80 |
| **API Simplicity** | Outstanding | Good | Good |
| **Best For** | Developers | Enterprise | Marketing |
| **Dashboard** | Modern | Traditional | Full-featured |

---

## Troubleshooting

### Issue: `RESEND_API_KEY is not configured`

**Solution:** Make sure `.env` has the correct key:
```env
RESEND_API_KEY=re_your_key_here
```

### Issue: `Invalid from email address`

**Solution:** The email must be verified in Resend. Either:
- Verify your domain in Resend dashboard, or
- Use `onboarding@resend.dev` temporarily for testing

### Issue: Emails not arriving

**Solution:** Check Resend dashboard → Analytics to see if emails were sent and if there were failures

---

## Testing with Resend

### Use Test Email Addresses

Resend provides test email addresses that always work:

- `delivered@resend.dev` - Always succeeds
- `bounce@resend.dev` - Simulates bounce
- `oops@resend.dev` - Simulates spam complaint

### Example Test

```typescript
// This will always succeed
await emailService.sendOtp('delivered@resend.dev', '123456');
```

---

## Advanced: Rate Limiting

Resend API limits:
- **Free plan:** 100 emails/day
- **Pro plan:** 50,000 emails/month (no daily limit)

Your provider automatically handles retries if rate-limited.

---

## Support

- **Documentation:** https://resend.com/docs
- **API Reference:** https://resend.com/docs/api-reference/emails/send
- **Support:** support@resend.com

---

## Next Steps

✅ Environment variables configured  
✅ Provider switched to ResendEmailProvider  
✅ Tested with `onboarding@resend.dev` or verified domain  
✅ Ready for production!
