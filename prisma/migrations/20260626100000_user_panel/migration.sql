-- Faz 6B: Kullanıcı paneli — kayıtlar, listeler, takip, bildirim tercihleri, son görüntülenenler
-- Katalog silindiğinde ilgili kullanıcı satırları silinir; kullanıcı işlemleri katalogu silmez.

CREATE TABLE IF NOT EXISTS saved_articles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_articles_user ON saved_articles (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reading_lists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_lists_user ON reading_lists (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS reading_list_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    uuid NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
  article_id bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_list_items_list ON reading_list_items (list_id, position);

CREATE TABLE IF NOT EXISTS followed_journals (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id bigint NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, journal_id)
);

CREATE INDEX IF NOT EXISTS idx_followed_journals_user ON followed_journals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS followed_authors (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id  bigint NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_followed_authors_user ON followed_authors (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  followed_journal_new_issue   boolean NOT NULL DEFAULT false,
  followed_author_new_article  boolean NOT NULL DEFAULT false,
  saved_search_alert           boolean NOT NULL DEFAULT false,
  weekly_digest                boolean NOT NULL DEFAULT false,
  product_announcements        boolean NOT NULL DEFAULT false,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recent_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('article', 'journal', 'author')),
  entity_id   bigint NOT NULL,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_views_user ON recent_views (user_id, viewed_at DESC);
