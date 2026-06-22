-- ─────────────────────────────────────────────────────────────────────────────
-- 018 — authors.source_key (deterministik ETL kimliği)
--
-- Format:
--   mysql-author:{legacyAuthorId}
--   article:{articleId}:position:{authorPosition}
--
-- PostgREST upsert: onConflict source_key (tam unique index; çoklu NULL serbest)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS source_key text;

COMMENT ON COLUMN authors.source_key IS
  'Deterministik ETL kimliği. Upsert onConflict source_key. İsim içermez.';

CREATE UNIQUE INDEX IF NOT EXISTS authors_source_key_uidx
  ON public.authors (source_key);
