CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "location_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "captured_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "location_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "image" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_menu_items" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_menu_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "menu_scans" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "scan_photo" TEXT NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_scans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_components" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "row_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_components_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingredient_details" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "row_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "menu_items_name_key" ON "menu_items"("name");
CREATE UNIQUE INDEX "idx_user_menu_items_item_user" ON "user_menu_items"("item_id", "user_id");
CREATE UNIQUE INDEX "idx_item_components_item_name" ON "item_components"("item_id", "name");
CREATE UNIQUE INDEX "idx_ingredient_details_item_name" ON "ingredient_details"("item_id", "name");

ALTER TABLE "location_history"
    ADD CONSTRAINT "location_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_menu_items"
    ADD CONSTRAINT "user_menu_items_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_menu_items"
    ADD CONSTRAINT "user_menu_items_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "menu_scans"
    ADD CONSTRAINT "menu_scans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_components"
    ADD CONSTRAINT "item_components_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_details"
    ADD CONSTRAINT "ingredient_details_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
