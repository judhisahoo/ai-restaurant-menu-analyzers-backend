# Name Field Migration Guide

## Summary of Changes

This migration adds a `name` field to the `user` table to store the user's full name during registration.

### Files Modified:
1. **prisma/migrations/20260410000001_add_name_to_user/migration.sql** - New migration file
2. **prisma/schema.prisma** - Updated User model to include name field
3. **src/user/dto/register-user.dto.ts** - Added name field as required input with Swagger documentation
4. **src/user/user.service.ts** - Updated register method to persist name

### What Was Changed:
- ✅ Added `name` column to the `user` table
- ✅ Added `name` field to User model in Prisma schema
- ✅ Added `name` to RegisterUserDto with validation (min 2 characters)
- ✅ Updated Swagger documentation with `@ApiProperty` decorator for name field
- ✅ Updated register endpoint to save name to database
- ✅ Updated response to include name from saved record

---

## How to Run Migration on Supabase

### Quick Command:
```bash
npx prisma migrate deploy
```

This will apply all pending migrations, including this new one.

### Step-by-Step:

1. **Verify `.env` configuration**:
   ```env
   DIRECT_URL="postgresql://postgres.vbgqvlmrkctbodiudfkc:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
   ```

2. **Run migration**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Verify in Supabase Dashboard** (SQL Editor):
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'user' 
   ORDER BY ordinal_position;
   ```
   
   Should see: `name | text | YES`

---

## Updated Register API

### Request Example:
```bash
POST /api/user/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "deviceId": "device-abc-123",
  "latitude": 20.2961,
  "longitude": 85.8245,
  "accuracy": 5.7
}
```

### Validation:
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| email | string | ✅ Yes | Valid email format |
| name | string | ✅ Yes | Min 2 characters |
| deviceId | string | ✅ Yes | Min 3 characters |
| latitude | number | ✅ Yes | Decimal number |
| longitude | number | ✅ Yes | Decimal number |
| accuracy | number | ❌ No | Optional decimal |

### Response Example:
```json
{
  "message": "User registered successfully.",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
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

---

## Swagger UI Updates

The `@ApiProperty` decorator for the `name` field will automatically update the Swagger documentation:

- **Field**: name
- **Type**: string
- **Required**: ✅ Yes
- **Example**: "John Doe"
- **Validation**: Minimum 2 characters

View the updated documentation at:
```
http://localhost:3000/api/docs
```

---

## Database Schema After Migration

The `user` table will now have:

```sql
CREATE TABLE "user" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,                  -- NEW: User's full name
    "deviceId" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

---

## Testing

### Test via cURL:
```bash
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "deviceId": "test-device-123",
    "latitude": 20.2961,
    "longitude": 85.8245,
    "accuracy": 5.7
  }'
```

### Error Examples:

**Missing name:**
```json
{
  "error": "Bad Request",
  "message": ["name should not be empty"],
  "statusCode": 400
}
```

**Name too short:**
```json
{
  "error": "Bad Request",
  "message": ["Name must be at least 2 characters long"],
  "statusCode": 400
}
```

---

## Running Both Migrations

To apply both migrations (deviceId and name) in one go:

```bash
npx prisma migrate deploy
```

This will execute:
1. `20260410000000_add_device_id_to_user/migration.sql`
2. `20260410000001_add_name_to_user/migration.sql`

Both will be applied in order to your Supabase database.

---

## Related Files

- **Migration**: [prisma/migrations/20260410000001_add_name_to_user/migration.sql](prisma/migrations/20260410000001_add_name_to_user/migration.sql)
- **Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **DTO**: [src/user/dto/register-user.dto.ts](src/user/dto/register-user.dto.ts)
- **Service**: [src/user/user.service.ts](src/user/user.service.ts)

---

## Next Steps

1. ✅ Run: `npx prisma migrate deploy`
2. ✅ Check Swagger UI at `/api/docs` to see updated documentation
3. ✅ Test the `/register` endpoint with the new `name` field
4. ✅ Deploy changes to production

---

## Troubleshooting

**Issue**: "name column already exists"
- **Solution**: Migration likely already applied. This is fine, just verify with the SQL query above.

**Issue**: "Validation error: name must be at least 2 characters"
- **Solution**: Ensure the `name` field in the request is at least 2 characters long.

**Issue**: Swagger documentation not updated
- **Solution**: Restart the application, then visit `/api/docs` again.
