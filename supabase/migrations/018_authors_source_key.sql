-- ─────────────────────────────────────────────────────────────────────────────
-- 018 — authors.source_key (deterministik ETL kimliği)
--
-- Format:
--   mysql-author:{legacyAuthorId}
--   article:{articleId}:position:{authorPosition}
--
-- Notlar:
-- - source_key nullable kalır; UNIQUE index çoklu NULL'a zaten izin verir.
-- - ETL upsert onConflict: 'source_key' kullanır.
-- - Belirsiz provisional kayıtlar sessizce güncellenmez (NOTICE ile raporlanır).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.authors
  ADD COLUMN IF NOT EXISTS source_key text;

COMMENT ON COLUMN public.authors.source_key IS
  'Deterministik ETL kimliği. Canonical: mysql-author:{id}, provisional: article:{article_id}:position:{n}';

-- Eski/ara format normalize (idempotent)
UPDATE public.authors
SET source_key = regexp_replace(source_key, '^mysql_yazarlar:', 'mysql-author:')
WHERE source_key ~ '^mysql_yazarlar:[0-9]+$';

UPDATE public.authors
SET source_key = regexp_replace(source_key, '^article:([0-9]+):pos:([0-9]+)$', 'article:\1:position:\2')
WHERE source_key ~ '^article:[0-9]+:pos:[0-9]+$';

-- Canonical backfill (is_provisional=false, legacy_id pozitif)
UPDATE public.authors
SET source_key = 'mysql-author:' || legacy_id::text
WHERE source_key IS NULL
  AND is_provisional = false
  AND legacy_id IS NOT NULL
  AND legacy_id > 0;

-- Provisional backfill: article_authors üzerinden gerçek article_id + author_position ile
-- Yalnızca tek makale + tek pozisyona sahip kayıtları doldur.
WITH provisional_single_relation AS (
  SELECT
    a.id AS author_id,
    MIN(aa.article_id)::bigint AS article_id,
    MIN(aa.author_position)::int AS author_position,
    COUNT(*) AS relation_count,
    COUNT(DISTINCT aa.article_id) AS distinct_articles,
    COUNT(DISTINCT aa.author_position) AS distinct_positions
  FROM public.authors a
  JOIN public.article_authors aa ON aa.author_id = a.id
  WHERE a.is_provisional = true
    AND a.source_key IS NULL
  GROUP BY a.id
),
provisional_fillable AS (
  SELECT author_id, article_id, author_position
  FROM provisional_single_relation
  WHERE distinct_articles = 1
    AND distinct_positions = 1
    AND author_position IS NOT NULL
    AND author_position > 0
)
UPDATE public.authors a
SET source_key = 'article:' || f.article_id::text || ':position:' || f.author_position::text
FROM provisional_fillable f
WHERE a.id = f.author_id
  AND a.source_key IS NULL;

-- Rapor amaçlı NOTICE'lar (migration logunda görünür)
DO $$
DECLARE
  v_provisional_no_relation int;
  v_provisional_multi_relation int;
  v_provisional_still_null int;
BEGIN
  SELECT COUNT(*) INTO v_provisional_no_relation
  FROM public.authors a
  LEFT JOIN public.article_authors aa ON aa.author_id = a.id
  WHERE a.is_provisional = true
    AND a.source_key IS NULL
    AND aa.author_id IS NULL;

  SELECT COUNT(*) INTO v_provisional_multi_relation
  FROM (
    SELECT a.id
    FROM public.authors a
    JOIN public.article_authors aa ON aa.author_id = a.id
    WHERE a.is_provisional = true
      AND a.source_key IS NULL
    GROUP BY a.id
    HAVING COUNT(DISTINCT aa.article_id) > 1 OR COUNT(DISTINCT aa.author_position) > 1
  ) t;

  SELECT COUNT(*) INTO v_provisional_still_null
  FROM public.authors
  WHERE is_provisional = true
    AND source_key IS NULL;

  RAISE NOTICE '018 source_key: provisional no relation=%', v_provisional_no_relation;
  RAISE NOTICE '018 source_key: provisional multi relation=%', v_provisional_multi_relation;
  RAISE NOTICE '018 source_key: provisional still null=%', v_provisional_still_null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS authors_source_key_uidx
  ON public.authors (source_key);
