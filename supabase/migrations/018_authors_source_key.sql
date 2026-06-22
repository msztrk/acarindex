-- ─────────────────────────────────────────────────────────────────────────────
-- 018 — authors.source_key (deterministik kimlik, bigint overflow alternatifi)
--
-- provisional: article:{id}:pos:{n}
-- canonical:   mysql_yazarlar:{id}
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS source_key text;

COMMENT ON COLUMN authors.source_key IS
  'Deterministik ETL kimliği. Upsert ve reconciliation için.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_source_key_unique
  ON authors (source_key)
  WHERE source_key IS NOT NULL;

-- Mevcut provisional negatif legacy_id kayıtları için source_key doldur (opsiyonel backfill)
UPDATE authors
SET source_key = 'legacy_neg:' || legacy_id::text
WHERE source_key IS NULL
  AND legacy_id IS NOT NULL
  AND legacy_id < 0;

UPDATE authors
SET source_key = 'mysql_yazarlar:' || legacy_id::text
WHERE source_key IS NULL
  AND legacy_id IS NOT NULL
  AND legacy_id > 0;
