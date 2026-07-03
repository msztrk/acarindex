-- English content availability flags (SEO indexing, separate from slug_en URL fallback)

ALTER TABLE journals
  ADD COLUMN has_en_content boolean NOT NULL DEFAULT false;

ALTER TABLE articles
  ADD COLUMN has_en_content boolean NOT NULL DEFAULT false;

UPDATE articles
SET has_en_content = (
  title_en IS NOT NULL
  AND char_length(trim(title_en)) >= 10
  AND (
    (abstract_en IS NOT NULL AND char_length(trim(abstract_en)) >= 20)
    OR lower(trim(coalesce(nullif(trim(document_language), ''), nullif(trim(language), ''), ''))) LIKE 'en%'
  )
);

UPDATE journals
SET has_en_content = (
  title_en IS NOT NULL AND char_length(trim(title_en)) >= 10
);

CREATE INDEX idx_articles_published_en_content ON articles (id)
  WHERE status = 'published' AND has_en_content = true;

CREATE INDEX idx_journals_published_en_content ON journals (id)
  WHERE status = 'published' AND has_en_content = true;
