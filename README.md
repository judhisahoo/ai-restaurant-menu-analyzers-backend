# Restaurant Menu AI Backend

NestJS REST API for the thesis workflow below:

1. A visitor scans a restaurant menu card.
2. A cloud AI model processes the scanned menu image.
3. The AI returns a short description and sample image for each dish.
4. The user selects a dish to view components used to prepare it.
5. The user opens ingredient details for each component flow.

## Main Features

- SQLite database with auto-created schema
- Swagger UI and JSON document output
- REST APIs for user registration, OTP intake, location history, menu scans, dish items, components, and ingredients
- Upload folder handling for `scan_photo` and `item_image`

## Run

```bash
npm install
npm run start:dev
```

Swagger UI: `http://localhost:3000/api/docs`  
Swagger JSON: `http://localhost:3000/api/docs-json`
