-- Site settings (hero metinleri vb.)
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_by" UUID,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);
