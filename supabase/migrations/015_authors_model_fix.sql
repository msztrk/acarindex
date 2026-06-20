-- ─────────────────────────────────────────────────────────────────────────────
-- 015 — authors veri modeli düzeltmesi
--
-- 1. authors.name UNIQUE constraint kaldır
--    Aynı isimde farklı akademisyenler bulunabilir.
--
-- 2. ORCID doluysa partial UNIQUE constraint ekle
--    orcid IS NOT NULL olduğunda tekrar eden kayıt engellensin.
--
-- 3. article_authors: kolon isimlerini düzelt
--    position     → author_position
--    raw_name     → raw_author_name
--
-- 4. authors: is_provisional flag ekle
--    authors_raw parse ile eklenen yazarlar provisional=true
--    Manuel doğrulama sonrası false yapılacak.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. UNIQUE(name) kaldır
ALTER TABLE authors
  DROP CONSTRAINT IF EXISTS authors_name_unique;

-- 2. ORCID partial unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_orcid_unique'
  ) THEN
    ALTER TABLE authors
      ADD CONSTRAINT authors_orcid_unique UNIQUE (orcid);
  END IF;
END $$;

-- ORCID unique'i partial yap: NULL'lar hariç
-- (PostgreSQL'de UNIQUE NULL'ları karşılaştırmaz, dolayısıyla zaten partial)

-- 3a. position → author_position
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_authors' AND column_name = 'position'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_authors' AND column_name = 'author_position'
  ) THEN
    ALTER TABLE article_authors RENAME COLUMN position TO author_position;
  END IF;
END $$;

-- 3b. raw_name → raw_author_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_authors' AND column_name = 'raw_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_authors' AND column_name = 'raw_author_name'
  ) THEN
    ALTER TABLE article_authors RENAME COLUMN raw_name TO raw_author_name;
  END IF;
END $$;

-- 4. Provisional flag ekle
ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN authors.is_provisional IS
  'true: authors_raw parse ile oluşturuldu, manuel doğrulama bekliyor. false: onaylandı.';

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_authors_provisional ON authors (is_provisional) WHERE is_provisional = true;
CREATE INDEX IF NOT EXISTS idx_authors_orcid       ON authors (orcid) WHERE orcid IS NOT NULL;
