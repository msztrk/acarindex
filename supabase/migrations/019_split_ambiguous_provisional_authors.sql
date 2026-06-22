-- ─────────────────────────────────────────────────────────────────────────────
-- 019 — çoklu ilişkili provisional author kayıtlarını böl
--
-- Her benzersiz (article_id, author_position) çifti tek provisional author alır.
-- source_key: article:{articleId}:position:{authorPosition}
--
-- Idempotent: ikinci çalışmada ambiguous kayıt yoksa no-op.
-- 017/018 dosyalarını değiştirmez.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ön koşul: source_key kolonu (018)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'authors'
      AND column_name = 'source_key'
  ) THEN
    RAISE EXCEPTION '019 requires migration 018 (authors.source_key column missing)';
  END IF;
END $$;

-- Ön kontroller
DO $$
DECLARE
  v_dup_pos int;
  v_dup_pair int;
  v_canon int;
  v_missing_article int;
  v_missing_author int;
  v_sk_conflict int;
BEGIN
  SELECT COUNT(*) INTO v_dup_pos
  FROM (
    SELECT article_id, author_position
    FROM public.article_authors
    WHERE author_position IS NOT NULL
    GROUP BY article_id, author_position
    HAVING COUNT(*) > 1
  ) t;

  IF v_dup_pos > 0 THEN
    RAISE EXCEPTION '019 preflight: duplicate article_id+author_position pairs=%', v_dup_pos;
  END IF;

  SELECT COUNT(*) INTO v_dup_pair
  FROM (
    SELECT article_id, author_id
    FROM public.article_authors
    GROUP BY article_id, author_id
    HAVING COUNT(*) > 1
  ) t;

  IF v_dup_pair > 0 THEN
    RAISE EXCEPTION '019 preflight: duplicate article_id+author_id pairs=%', v_dup_pair;
  END IF;

  SELECT COUNT(*) INTO v_canon
  FROM (
    SELECT a.id
    FROM public.authors a
    JOIN public.article_authors aa ON aa.author_id = a.id
    WHERE a.is_provisional = false
    GROUP BY a.id
    HAVING COUNT(aa.*) > 1
       AND (COUNT(DISTINCT aa.article_id) > 1 OR COUNT(DISTINCT aa.author_position) > 1)
  ) t;

  IF v_canon > 0 THEN
    RAISE EXCEPTION '019 preflight: canonical author in split scope count=%', v_canon;
  END IF;

  SELECT COUNT(*) INTO v_missing_article
  FROM public.article_authors aa
  LEFT JOIN public.articles ar ON ar.id = aa.article_id
  WHERE ar.id IS NULL;

  IF v_missing_article > 0 THEN
    RAISE EXCEPTION '019 preflight: article_authors with missing article=%', v_missing_article;
  END IF;

  SELECT COUNT(*) INTO v_missing_author
  FROM public.article_authors aa
  LEFT JOIN public.authors a ON a.id = aa.author_id
  WHERE a.id IS NULL;

  IF v_missing_author > 0 THEN
    RAISE EXCEPTION '019 preflight: article_authors with missing author=%', v_missing_author;
  END IF;

  -- Planlanan source_key başka bir author'a atanmış mı?
  SELECT COUNT(*) INTO v_sk_conflict
  FROM (
    SELECT DISTINCT
      'article:' || aa.article_id::text || ':position:' || aa.author_position::text AS sk,
      aa.author_id AS rel_author_id
    FROM public.authors a
    JOIN public.article_authors aa ON aa.author_id = a.id
    WHERE a.is_provisional = true
      AND aa.author_position IS NOT NULL
      AND aa.author_position > 0
    GROUP BY a.id, aa.article_id, aa.author_position, aa.author_id
    HAVING (
      SELECT COUNT(*)
      FROM public.article_authors aa2
      WHERE aa2.author_id = a.id
    ) > 1
  ) planned
  JOIN public.authors existing ON existing.source_key = planned.sk
  WHERE existing.id <> planned.rel_author_id;

  IF v_sk_conflict > 0 THEN
    RAISE EXCEPTION '019 preflight: source_key would conflict with existing author count=%', v_sk_conflict;
  END IF;
END $$;

-- Ana split
DO $$
DECLARE
  amb RECORD;
  rel RECORD;
  v_sk text;
  v_target_id bigint;
  v_new_id bigint;
  v_leg bigint;
  v_ambiguous_count int;
  v_moved int := 0;
  v_created int := 0;
BEGIN
  SELECT COUNT(*) INTO v_ambiguous_count
  FROM (
    SELECT a.id
    FROM public.authors a
    JOIN public.article_authors aa ON aa.author_id = a.id
    WHERE a.is_provisional = true
    GROUP BY a.id
    HAVING COUNT(aa.*) > 1
       AND (COUNT(DISTINCT aa.article_id) > 1 OR COUNT(DISTINCT aa.author_position) > 1)
  ) t;

  IF v_ambiguous_count = 0 THEN
    RAISE NOTICE '019 split: no ambiguous provisional authors — no-op';
    RETURN;
  END IF;

  RAISE NOTICE '019 split: ambiguous provisional authors=%', v_ambiguous_count;

  FOR amb IN
    SELECT a.id AS author_id, a.name, a.slug
    FROM public.authors a
    WHERE a.is_provisional = true
      AND a.id IN (
        SELECT a2.id
        FROM public.authors a2
        JOIN public.article_authors aa ON aa.author_id = a2.id
        WHERE a2.is_provisional = true
        GROUP BY a2.id
        HAVING COUNT(aa.*) > 1
           AND (COUNT(DISTINCT aa.article_id) > 1 OR COUNT(DISTINCT aa.author_position) > 1)
      )
    ORDER BY a.id
  LOOP
    FOR rel IN
      SELECT
        aa.article_id,
        aa.author_position,
        ROW_NUMBER() OVER (ORDER BY aa.article_id, aa.author_position) AS rn
      FROM public.article_authors aa
      WHERE aa.author_id = amb.author_id
        AND aa.author_position IS NOT NULL
        AND aa.author_position > 0
      ORDER BY aa.article_id, aa.author_position
    LOOP
      v_sk := 'article:' || rel.article_id::text || ':position:' || rel.author_position::text;

      IF rel.rn = 1 THEN
        IF EXISTS (
          SELECT 1 FROM public.authors
          WHERE source_key = v_sk AND id <> amb.author_id
        ) THEN
          RAISE EXCEPTION '019 split: source_key % already owned by another author (author_id=%)',
            v_sk, amb.author_id;
        END IF;

        UPDATE public.authors
        SET source_key = v_sk
        WHERE id = amb.author_id
          AND (source_key IS NULL OR source_key = v_sk);
      ELSE
        SELECT id INTO v_target_id
        FROM public.authors
        WHERE source_key = v_sk
        LIMIT 1;

        IF v_target_id IS NULL THEN
          v_leg := -((rel.article_id::bigint * 10000000::bigint) + rel.author_position::bigint);

          IF EXISTS (SELECT 1 FROM public.authors WHERE legacy_id = v_leg) THEN
            RAISE EXCEPTION '019 split: legacy_id collision % for article=% position=%',
              v_leg, rel.article_id, rel.author_position;
          END IF;

          INSERT INTO public.authors (name, slug, legacy_id, is_provisional, source_key)
          VALUES (amb.name, amb.slug, v_leg, true, v_sk)
          RETURNING id INTO v_new_id;

          v_target_id := v_new_id;
          v_created := v_created + 1;
        END IF;

        IF v_target_id <> amb.author_id THEN
          UPDATE public.article_authors
          SET author_id = v_target_id
          WHERE article_id = rel.article_id
            AND author_position = rel.author_position
            AND author_id = amb.author_id;

          IF FOUND THEN
            v_moved := v_moved + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '019 split: new provisional authors=% relations moved=%', v_created, v_moved;
END $$;

-- Son invariant kontrolleri
DO $$
DECLARE
  v int;
BEGIN
  SELECT COUNT(*) INTO v
  FROM (
    SELECT source_key FROM public.authors
    WHERE source_key IS NOT NULL
    GROUP BY source_key HAVING COUNT(*) > 1
  ) t;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: duplicate source_key=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM (
    SELECT article_id, author_position
    FROM public.article_authors
    WHERE author_position IS NOT NULL
    GROUP BY article_id, author_position HAVING COUNT(*) > 1
  ) t;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: duplicate article_id+author_position=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM (
    SELECT article_id, author_id
    FROM public.article_authors
    GROUP BY article_id, author_id HAVING COUNT(*) > 1
  ) t;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: duplicate article_id+author_id=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM public.article_authors
  WHERE author_position IS NOT NULL AND author_position <= 0;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: author_position<=0=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM public.authors a
  JOIN public.article_authors aa ON aa.author_id = a.id
  WHERE a.is_provisional = true AND a.source_key IS NULL;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: linked provisional null source_key=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM public.authors a
  LEFT JOIN public.article_authors aa ON aa.author_id = a.id
  WHERE a.is_provisional = true AND aa.author_id IS NULL;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: orphan provisional=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM (
    SELECT a.id
    FROM public.authors a
    JOIN public.article_authors aa ON aa.author_id = a.id
    WHERE a.is_provisional = true
    GROUP BY a.id HAVING COUNT(aa.*) > 1
  ) t;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: multi-relation provisional=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM public.article_authors aa
  LEFT JOIN public.authors a ON a.id = aa.author_id
  WHERE a.id IS NULL;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: orphan author relation=%', v; END IF;

  SELECT COUNT(*) INTO v
  FROM public.article_authors aa
  LEFT JOIN public.articles ar ON ar.id = aa.article_id
  WHERE ar.id IS NULL;
  IF v > 0 THEN RAISE EXCEPTION '019 postcheck: orphan article relation=%', v; END IF;

  RAISE NOTICE '019 postcheck: all invariants passed';
END $$;
