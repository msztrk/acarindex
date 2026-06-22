-- AcarIndex baseline catalog schema (standart PostgreSQL)
-- Konsolide: supabase/migrations 001–004, 005, 012, 015, 018 (RLS opsiyonel, yerel dev için kapalı)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── categories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          bigint PRIMARY KEY,
  legacy_id   bigint UNIQUE,
  name_tr     text,
  name_en     text,
  slug        text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── journals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journals (
  id                  bigint PRIMARY KEY,
  legacy_id           bigint UNIQUE,
  slug                text NOT NULL,
  title_tr            text,
  title_en            text,
  old_name            text,
  issn                text,
  eissn               text,
  publisher           text,
  frequency           text,
  start_year          text,
  publication_format  text,
  publish_language    text,
  subject_category    text,
  topics              text,
  editor_in_chief     text,
  editorial_board     text,
  colophon            text,
  description         text,
  about               text,
  aim_and_scope       text,
  policy              text,
  writing_rules       text,
  price_policy        text,
  indexes_text        text,
  years_indexed       text,
  contact_text        text,
  contact_json        jsonb,
  cover_path          text,
  legacy_link         text,
  category_id         bigint REFERENCES categories(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
  hit_count           int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journals_slug ON journals (slug);
CREATE INDEX IF NOT EXISTS idx_journals_status ON journals (status);

-- ─── issues ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
  id                  bigint PRIMARY KEY,
  legacy_id           bigint UNIQUE,
  journal_id          bigint NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  year                int,
  issue_number        text,
  volume              text,
  issue_label         text,
  dergipark_issue_id  bigint,
  status              text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
  hit_count           int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_journal_year ON issues (journal_id, year DESC);

-- ─── articles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id                    bigint PRIMARY KEY,
  legacy_id             bigint UNIQUE,
  slug                  text NOT NULL,
  legacy_journal_slug   text NOT NULL,
  journal_id            bigint NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  issue_id              bigint REFERENCES issues(id) ON DELETE SET NULL,
  title_tr              text,
  title_en              text,
  authors_raw           text,
  authors_citation      text,
  legacy_author_ids     text,
  institution_raw       text,
  abstract_tr           text,
  abstract_en           text,
  keywords_tr           text,
  keywords_en           text,
  references_raw        text,
  citation_format       text,
  page_start            int,
  page_end              int,
  published_at          date,
  published_year        int,
  submission_dates      text,
  language              text,
  document_language     text,
  document_type         text,
  article_type          text,
  access_type           text DEFAULT 'open',
  section               text,
  subject_area          text,
  doi                   text,
  dergipark_issue_id    bigint,
  hit_count             int NOT NULL DEFAULT 0,
  download_count        int NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'published'
                        CHECK (status IN ('published', 'draft', 'review', 'archived')),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title_tr, '') || ' ' ||
      coalesce(title_en, '') || ' ' ||
      coalesce(authors_raw, '') || ' ' ||
      coalesce(keywords_tr, '') || ' ' ||
      coalesce(keywords_en, '') || ' ' ||
      coalesce(abstract_tr, '') || ' ' ||
      coalesce(abstract_en, '')
    )
  ) STORED,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_journal_year ON articles (journal_id, published_year DESC);
CREATE INDEX IF NOT EXISTS idx_articles_issue ON articles (issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_slug_id ON articles (legacy_journal_slug, slug, id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status);

-- ─── pdf_files ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        bigint UNIQUE NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  legacy_pdf_path   text,
  storage_key       text,
  cdn_url           text,
  file_size_bytes   bigint,
  page_count        int,
  checksum_sha256   text,
  file_status       text NOT NULL DEFAULT 'legacy'
                    CHECK (file_status IN ('legacy', 'available', 'missing', 'migrated')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdf_files_status ON pdf_files (file_status);

-- ─── authors ────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS authors_id_seq;

CREATE TABLE IF NOT EXISTS authors (
  id              bigint PRIMARY KEY DEFAULT nextval('authors_id_seq'),
  legacy_id       bigint UNIQUE,
  slug            text,
  name            text NOT NULL,
  title           text,
  institution     text,
  bio             text,
  orcid           text UNIQUE,
  email           text,
  is_provisional  boolean NOT NULL DEFAULT false,
  source_key      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

SELECT setval('authors_id_seq', COALESCE((SELECT MAX(id) FROM authors), 0) + 1, false);

CREATE UNIQUE INDEX IF NOT EXISTS authors_source_key_uidx ON authors (source_key);
CREATE INDEX IF NOT EXISTS idx_authors_provisional ON authors (is_provisional) WHERE is_provisional = true;

-- ─── article_authors ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_authors (
  article_id        bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id         bigint NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  author_position   int,
  raw_author_name   text,
  PRIMARY KEY (article_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_article_authors_author ON article_authors (author_id);
CREATE INDEX IF NOT EXISTS idx_article_authors_article ON article_authors (article_id);

-- ─── url_aliases ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS url_aliases (
  legacy_path     text PRIMARY KEY,
  canonical_path  text NOT NULL,
  entity_type     text,
  entity_id       bigint,
  http_status     int NOT NULL DEFAULT 200,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── platform_stats view ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW platform_stats AS
SELECT
  (SELECT COUNT(*)::bigint FROM journals WHERE status = 'published') AS journal_count,
  (SELECT COUNT(*)::bigint FROM articles WHERE status = 'published') AS article_count,
  (SELECT COUNT(*)::bigint FROM pdf_files WHERE file_status != 'missing') AS pdf_count,
  (SELECT COALESCE(SUM(hit_count), 0)::bigint FROM articles WHERE status = 'published') AS total_hits,
  (SELECT COUNT(*)::bigint FROM authors) AS author_count,
  0::bigint AS institution_count,
  now() AS refreshed_at;

-- ─── etl audit ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etl_runs (
  id              bigserial PRIMARY KEY,
  run_id          text NOT NULL UNIQUE,
  script          text NOT NULL,
  mode            text NOT NULL DEFAULT 'full' CHECK (mode IN ('full', 'pilot', 'dry-run')),
  source_table    text,
  target_table    text,
  limit_rows      int,
  offset_rows     int DEFAULT 0,
  rows_read       int NOT NULL DEFAULT 0,
  rows_inserted   int NOT NULL DEFAULT 0,
  rows_updated    int NOT NULL DEFAULT 0,
  rows_skipped    int NOT NULL DEFAULT 0,
  rows_error      int NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'success', 'partial', 'failed', 'interrupted')),
  error_summary   text,
  notes           text
);

CREATE TABLE IF NOT EXISTS etl_errors (
  id              bigserial PRIMARY KEY,
  run_id          text NOT NULL REFERENCES etl_runs(run_id) ON DELETE CASCADE,
  source_table    text,
  source_id       bigint,
  source_row      jsonb,
  error_type      text NOT NULL,
  error_message   text NOT NULL,
  field_name      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etl_runs_script ON etl_runs (script, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_etl_errors_run ON etl_errors (run_id);
