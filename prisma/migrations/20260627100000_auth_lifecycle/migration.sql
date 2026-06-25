-- Faz 6C: account lifecycle — legal acceptance, deletion requests, session last_used, verification used_at

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

ALTER TABLE verification_tokens ADD COLUMN IF NOT EXISTS used_at timestamptz;

CREATE TABLE IF NOT EXISTS legal_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,
  version      text NOT NULL,
  published_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  required     boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type_published ON legal_documents (type, published_at DESC);

CREATE TABLE IF NOT EXISTS user_legal_acceptances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id      uuid NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
  document_type    text NOT NULL,
  document_version text NOT NULL,
  document_hash    text NOT NULL,
  accepted_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_user_legal_user_type ON user_legal_acceptances (user_id, document_type);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending',
  requested_at  timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  cancelled_at  timestamptz,
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_status ON account_deletion_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON account_deletion_requests (scheduled_for);

CREATE TABLE IF NOT EXISTS abuse_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  key        text NOT NULL,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abuse_events_type_key ON abuse_events (event_type, key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_events_type_ip ON abuse_events (event_type, ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens (expires_at);

-- Placeholder legal documents (gerçek metinler operasyonel olarak sağlanacak)
INSERT INTO legal_documents (type, version, published_at, content_hash, required)
VALUES
  ('terms', 'placeholder-1.0', now(), 'sha256:placeholder-terms-1.0', true),
  ('privacy', 'placeholder-1.0', now(), 'sha256:placeholder-privacy-1.0', true),
  ('marketing', 'placeholder-1.0', now(), 'sha256:placeholder-marketing-1.0', false)
ON CONFLICT (type, version) DO NOTHING;
