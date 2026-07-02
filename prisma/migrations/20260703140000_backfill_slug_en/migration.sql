-- Backfill EN slugs from TR where English title slug was not generated yet.
-- EN URLs fall back to TR slug when no distinct English title exists.

UPDATE categories
SET slug_en = slug_tr
WHERE slug_en IS NULL AND slug_tr IS NOT NULL;

UPDATE journals
SET slug_en = slug_tr
WHERE slug_en IS NULL AND slug_tr IS NOT NULL;

UPDATE articles
SET slug_en = slug_tr
WHERE slug_en IS NULL AND slug_tr IS NOT NULL;
