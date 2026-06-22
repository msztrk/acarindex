-- ─────────────────────────────────────────────────────────────────────────────
-- 019 — source_key backfill ve eski 018 partial index temizliği
--
-- Önce scripts/etl/report-source-key-backfill.ts ile çakışmaları inceleyin.
-- ─────────────────────────────────────────────────────────────────────────────

-- Eski partial index (erken 018) kaldır
DROP INDEX IF EXISTS idx_authors_source_key_unique;

-- Tam unique index (018 ile aynı; idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS authors_source_key_uidx
  ON public.authors (source_key);

-- Eski key formatlarını düzelt
UPDATE authors
SET source_key = 'mysql-author:' || legacy_id::text
WHERE source_key LIKE 'mysql_yazarlar:%';

UPDATE authors
SET source_key = regexp_replace(source_key, '^article:([0-9]+):pos:([0-9]+)$', 'article:\1:position:\2')
WHERE source_key ~ '^article:[0-9]+:pos:[0-9]+$';

-- legacy_neg formatını temizle — article_authors backfill ile değiştirilecek
UPDATE authors
SET source_key = NULL
WHERE source_key LIKE 'legacy_neg:%';

-- Canonical: mysql-author:{legacy_id}
UPDATE authors
SET source_key = 'mysql-author:' || legacy_id::text
WHERE source_key IS NULL
  AND is_provisional = false
  AND legacy_id IS NOT NULL
  AND legacy_id > 0;

-- Provisional: article_authors tek ilişki (author_id başına en küçük pozisyon)
UPDATE authors a
SET source_key = 'article:' || pick.article_id || ':position:' || pick.author_position
FROM (
  SELECT DISTINCT ON (aa.author_id)
    aa.author_id,
    aa.article_id,
    aa.author_position
  FROM article_authors aa
  WHERE aa.author_position IS NOT NULL
  ORDER BY aa.author_id, aa.author_position ASC, aa.article_id ASC
) pick
WHERE a.id = pick.author_id
  AND a.is_provisional = true
  AND a.source_key IS NULL;
