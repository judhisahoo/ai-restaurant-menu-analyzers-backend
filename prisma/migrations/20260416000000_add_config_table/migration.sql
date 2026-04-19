CREATE TABLE "config" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "config_name_key" ON "config"("name");

INSERT INTO "config" ("name", "value", "status")
VALUES ('menu_scan_ai_provider', 'gemini', true);
