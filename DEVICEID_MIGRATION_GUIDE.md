# DeviceId Migration Guide for Supabase

## Summary of Changes

This migration adds a `deviceId` column to the `user` table to store the device identifier sent by mobile/web clients during user registration.

### Files Modified:
1. **prisma/migrations/20260410000000_add_device_id_to_user/migration.sql** - New migration file
2. **prisma/schema.prisma** - Updated User model to include deviceId field
3. **src/user/user.service.ts** - Updated register method to persist deviceId

### What Was Changed:
- ✅ Added `deviceId` column to the `user` table
- ✅ Updated User model in Prisma schema
- ✅ Updated register endpoint to save deviceId to database
- ✅ Removed workaround note from register response

---

## How to Run Migration on Supabase

### Prerequisites:
- Node.js and npm installed
- Supabase project created
- `.env` file configured with Supabase credentials

### Step 1: Verify Your Environment Variables

Check your `.env` file has these variables configured:

```env
# PostgreSQL connection URL (for Connection Pooling)
DATABASE_URL="postgresql://postgres.vbgqvlmrkctbodiudfkc:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct database connection (for migrations - REQUIRED)
DIRECT_URL="postgresql://postgres.vbgqvlmrkctbodiudfkc:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

**Important**: The `DIRECT_URL` must use port **5432** (not 6543), as migrations require a direct connection without connection pooling.

### Step 2: Install Dependencies

Make sure Prisma CLI is installed:

```bash
npm install
```

If not already installed, add Prisma:

```bash
npm install -D prisma
```

### Step 3: Run the Migration

Execute the migration on your Supabase database:

```bash
npx prisma migrate deploy
```

**What this does:**
- Reads all pending migrations from `prisma/migrations/` folder
- Executes them against your Supabase database
- Updates the `_prisma_migrations` table to track completed migrations
- Regenerates the Prisma Client

### Example Output:
```
Applying migration `20260410000000_add_device_id_to_user`

The following migration(s) have been applied:

migrations/
  └─ 20260410000000_add_device_id_to_user/
    └─ migration.sql

Your database is now in sync with your schema.
```

### Step 4: Verify Migration Success

Check that the deviceId column was added:

```bash
npx prisma db pull
```

This command introspects your database and updates `schema.prisma` to match the actual database schema.

Or verify via Supabase Dashboard:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Login to your project
3. Go to **SQL Editor**
4. Run this query:

```sql
-- Check the user table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user' 
ORDER BY ordinal_position;
```

Expected output should include:
```
deviceId | text | YES
```

### Step 5: Update Prisma Client (Optional)

If you made changes to schema.prisma, regenerate the Prisma Client:

```bash
npx prisma generate
```

---

## Testing the Changes Locally

If you want to test locally first before deploying to Supabase:

### Option 1: Using SQLite for Local Testing

Switch to SQLite temporarily:

```bash
# In .env, comment out the Supabase URLs and use SQLite
# DATABASE_URL="file:./prisma/dev.db"
```

Then run:

```bash
npx prisma migrate dev --name add_device_id_to_user
```

### Option 2: Using a Local PostgreSQL

Set up local PostgreSQL and test before applying to Supabase.

---

## Troubleshooting

### Error: "DIRECT_URL must be set"
**Solution**: Ensure `DIRECT_URL` is configured in your `.env` file and uses the direct database URL (port 5432, not 6543).

```env
DIRECT_URL="postgresql://postgres.vbgqvlmrkctbodiudfkc:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

### Error: "Connection refused"
**Solution**: 
- Check your Supabase credentials in `.env`
- Verify the database password doesn't have special characters that need URL encoding
- Check IP whitelist settings in Supabase (go to Project Settings → Database → Firewall)

### Error: "Migration already applied"
**Solution**: This is normal if the migration was already executed. Just verify it worked using the verification query above.

### Error: "Permission denied"
**Solution**: 
- Ensure you're using a superuser or account with ALTER TABLE permissions
- In Supabase, use the `postgres` user account which has full permissions

---

## Database Schema After Migration

The `user` table will now have this structure:

```sql
CREATE TABLE "user" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "deviceId" TEXT,           -- NEW: Device identifier
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

---

## API Response After Migration

When users register, the API will now persist and return the deviceId:

### Request:
```bash
POST /api/user/register
Content-Type: application/json

{
  "email": "user@example.com",
  "deviceId": "device-abc-123",
  "latitude": 20.2961,
  "longitude": 85.8245,
  "accuracy": 5.7
}
```

### Response:
```json
{
  "message": "User registered successfully.",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "deviceId": "device-abc-123",
    "created_at": "2026-04-10T10:30:00.000Z",
    "updated_at": "2026-04-10T10:30:00.000Z",
    "verified_at": "2026-04-10T10:30:00.000Z",
    "location": {
      "id": 1,
      "latitude": 20.2961,
      "longitude": 85.8245,
      "accuracy": 5.7,
      "captured_at": "2026-04-10T10:30:00.000Z"
    }
  }
}
```

Notice: `deviceId` is now returned from the saved database record, not from the request payload.

---

## Rollback (If Needed)

If you need to revert this migration:

```bash
npx prisma migrate resolve --rolled-back 20260410000000_add_device_id_to_user
```

Then manually drop the column:

```sql
ALTER TABLE "user" DROP COLUMN IF EXISTS "deviceId";
```

---

## Next Steps

1. ✅ Run: `npx prisma migrate deploy`
2. ✅ Verify in Supabase Dashboard
3. ✅ Test the `/register` endpoint with a `deviceId`
4. ✅ Deploy the changes to production

---

## Related Files

- **Migration**: [prisma/migrations/20260410000000_add_device_id_to_user/migration.sql](prisma/migrations/20260410000000_add_device_id_to_user/migration.sql)
- **Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Service**: [src/user/user.service.ts](src/user/user.service.ts)
- **DTO**: [src/user/dto/register-user.dto.ts](src/user/dto/register-user.dto.ts)

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase PostgreSQL Best Practices](https://supabase.com/docs/guides/database)
- [Prisma Supabase Guide](https://www.prisma.io/docs/guides/database/using-prisma-with-supabase)
