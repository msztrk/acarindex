-- ─────────────────────────────────────────────────────────────────────────────
-- 016 — platform_stats pdf_count: erişilebilir tam metin sayısı
--
-- pdf_files reltuples toplamı yerine file_status='missing' hariç gerçek sayım.
-- Makale/dergi sayıları hâlâ reltuples (014 timeout düzeltmesi).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW platform_stats AS
SELECT
  GREATEST((SELECT reltuples::bigint FROM pg_class WHERE relname = 'journals'), 0)   AS journal_count,
  GREATEST((SELECT reltuples::bigint FROM pg_class WHERE relname = 'articles'), 0)   AS article_count,
  GREATEST(
    (SELECT COUNT(*)::bigint FROM pdf_files WHERE file_status IS DISTINCT FROM 'missing'),
    0
  )                                                                                  AS pdf_count,
  (SELECT COALESCE(SUM(hit_count), 0) FROM journals WHERE status = 'published')      AS total_hits,
  GREATEST((SELECT reltuples::bigint FROM pg_class WHERE relname = 'authors'), 0)    AS author_count,
  0::bigint                                                                            AS institution_count,
  now()                                                                                AS refreshed_at;
