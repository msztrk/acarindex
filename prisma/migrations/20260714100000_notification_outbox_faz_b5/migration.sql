-- Faz B5: Notification outbox for journal application admin notifications

DO $$ BEGIN
  CREATE TYPE notification_outbox_status AS ENUM (
    'pending', 'processing', 'sent', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notification_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL,
  recipient       text NOT NULL,
  payload         jsonb NOT NULL,
  status          notification_outbox_status NOT NULL DEFAULT 'pending',
  attempt_count   integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  sent_at         timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status_next
  ON notification_outbox (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_created
  ON notification_outbox (created_at DESC);
