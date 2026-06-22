-- ─────────────────────────────────────────────────────────────────────────────
-- 017 — authors + article_authors bütünlük kısıtları
--
-- - legacy_id partial unique (yazarlar.id ve provisional negatif kimlikler)
-- - article_authors: aynı makalede duplicate pozisyon engeli
-- - author_position > 0 kontrolü
-- ─────────────────────────────────────────────────────────────────────────────

-- legacy_id: yalnızca dolu değerler unique (NULL pilot kayıtları etkilemez)
CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_legacy_id_unique
  ON authors (legacy_id)
  WHERE legacy_id IS NOT NULL;

-- Aynı makalede iki yazar aynı pozisyonda olamaz
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_authors_article_position_unique
  ON article_authors (article_id, author_position)
  WHERE author_position IS NOT NULL;

-- Pozisyon 1'den başlamalı
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'article_authors_position_positive'
  ) THEN
    ALTER TABLE article_authors
      ADD CONSTRAINT article_authors_position_positive
      CHECK (author_position IS NULL OR author_position > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_authors_legacy_id ON authors (legacy_id) WHERE legacy_id IS NOT NULL;
