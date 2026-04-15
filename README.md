# Restaurant Menu AI Backend

NestJS REST API for the thesis workflow below:

1. A visitor scans a restaurant menu card.
2. A cloud AI model processes the scanned menu image.
3. The AI returns a short description and sample image for each dish.
4. The user selects a dish to view components used to prepare it.
5. The user opens ingredient details for each component flow.

## Main Features

- Prisma ORM with PostgreSQL schema, migrations, seed, and import/export scripts
- Supabase PostgreSQL support for Vercel deployment
- Vercel Blob storage for `scan_photo` and `item_image`
- `ON_LINE_PROCESS=true` support for live Gemini menu parsing, with offline fallback from `data/dish_data.json`
- Swagger UI and JSON document output
- REST APIs for user registration, OTP intake, location history, menu scans, dish items, components, and ingredients

Blob path layout:
- `scan_photo/...` for scanned menu uploads
- `item_image/...` for dish/item images

API response fields:
- `menu-scans.data.scan_photo` returns a public Vercel Blob URL
- `dish.items.created_items[].image` returns a public Vercel Blob URL
- `dish.item-search.data[].image` returns a public Vercel Blob URL when present

## Run

```bash
npm install
npm run start:dev
```

## Environment

Set these variables before starting the API:

```bash
DATABASE_URL=postgresql://postgres.[project-ref]:your-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:[your-password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_PROJECT_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
BLOB_READ_WRITE_TOKEN=vercel_blob_read_write_token
ON_LINE_PROCESS=false
GEMINI_API_KEY=your-gemini-api-key
```

Set `ON_LINE_PROCESS=true` only when `GEMINI_API_KEY` is configured and live Gemini extraction should be used.
When `ON_LINE_PROCESS=false`, `/menu-scans` returns normalized fallback dishes from `data/dish_data.json`.

Use the Supabase session pooler string in `DATABASE_URL` for local/persistent backend runtime.
Use the Supabase direct connection string in `DIRECT_URL` for Prisma migrations when your environment supports IPv6.
For Vercel serverless runtime, use the Supabase transaction pooler string separately in your Vercel `DATABASE_URL` environment variable.

## Prisma Workflow

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
npm run prisma:seed
npm run db:export -- prisma/data/export.json
npm run db:import -- prisma/data/export.json --replace
```

Notes:
- `prisma/seed-data.json` is the editable seed source file.
- `npm run db:export` writes a JSON snapshot of all Prisma-managed tables.
- `npm run db:import -- <file> --replace` clears current rows, imports the snapshot, and resets PostgreSQL sequences.

Swagger UI: `http://localhost:3000/api/docs`  
Swagger JSON: `http://localhost:3000/api/docs-json`
