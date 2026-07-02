-- TR/EN locale slug columns (slug = legacy TR canonical during transition)

ALTER TABLE categories
  ADD COLUMN slug_tr text,
  ADD COLUMN slug_en text;

ALTER TABLE journals
  ADD COLUMN slug_tr text,
  ADD COLUMN slug_en text;

ALTER TABLE articles
  ADD COLUMN slug_tr text,
  ADD COLUMN slug_en text,
  ADD COLUMN legacy_journal_slug_en text;

UPDATE categories SET slug_tr = slug WHERE slug IS NOT NULL;
UPDATE journals SET slug_tr = slug;
UPDATE articles SET slug_tr = slug;
UPDATE articles SET legacy_journal_slug_en = legacy_journal_slug
  WHERE legacy_journal_slug IS NOT NULL;

CREATE INDEX idx_journals_slug_en ON journals (slug_en)
  WHERE slug_en IS NOT NULL AND status = 'published';

CREATE INDEX idx_articles_i18n_path ON articles (legacy_journal_slug_en, slug_en, id)
  WHERE legacy_journal_slug_en IS NOT NULL AND slug_en IS NOT NULL AND status = 'published';
