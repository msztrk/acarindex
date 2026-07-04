-- Faz A: Başvuru ve Katkı Merkezi — içerik başvuru workflow tabloları
-- MembershipApplication değiştirilmez.

DO $$ BEGIN
  CREATE TYPE content_application_kind AS ENUM ('new_journal', 'announcement', 'data_correction');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE content_application_status AS ENUM (
    'draft', 'submitted', 'precheck', 'under_review',
    'revision_requested', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE application_revision_submission_type AS ENUM ('initial_submit', 'resubmit', 'admin_snapshot');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE application_attachment_kind AS ENUM (
    'proof_document', 'cover_image', 'announcement_image', 'evidence', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE application_attachment_upload_status AS ENUM ('pending', 'committed', 'orphaned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS content_applications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 content_application_kind NOT NULL,
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                text NOT NULL DEFAULT 'Taslak başvuru',
  status               content_application_status NOT NULL DEFAULT 'draft',
  draft_payload        jsonb,
  submitted_at         timestamptz,
  assigned_to          uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_revision_id uuid UNIQUE,
  approved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_applications_user_status
  ON content_applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_applications_status_created
  ON content_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_applications_assigned
  ON content_applications (assigned_to, status);

CREATE TABLE IF NOT EXISTS application_revisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES content_applications(id) ON DELETE CASCADE,
  revision_number int NOT NULL,
  snapshot_json   jsonb NOT NULL,
  created_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_type application_revision_submission_type NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_application_revisions_app_created
  ON application_revisions (application_id, created_at DESC);

ALTER TABLE content_applications
  DROP CONSTRAINT IF EXISTS content_applications_reviewed_revision_id_fkey;
ALTER TABLE content_applications
  ADD CONSTRAINT content_applications_reviewed_revision_id_fkey
  FOREIGN KEY (reviewed_revision_id) REFERENCES application_revisions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS application_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES content_applications(id) ON DELETE CASCADE,
  event_type     text NOT NULL,
  actor_id       uuid,
  from_status    text,
  to_status      text,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_events_app_created
  ON application_events (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS application_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES content_applications(id) ON DELETE CASCADE,
  reviewer_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision_id    uuid,
  decision       text,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_reviews_app_created
  ON application_reviews (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS application_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   uuid NOT NULL REFERENCES content_applications(id) ON DELETE CASCADE,
  kind             application_attachment_kind NOT NULL,
  storage_key      text NOT NULL,
  original_name    text NOT NULL,
  mime_type        text NOT NULL,
  size_bytes       int NOT NULL,
  checksum_sha256  text,
  upload_status    application_attachment_upload_status NOT NULL DEFAULT 'pending',
  uploaded_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_attachments_app
  ON application_attachments (application_id);
CREATE INDEX IF NOT EXISTS idx_application_attachments_orphan
  ON application_attachments (upload_status, created_at);

CREATE TABLE IF NOT EXISTS application_private_contacts (
  application_id uuid PRIMARY KEY REFERENCES content_applications(id) ON DELETE CASCADE,
  contact_name   text,
  contact_role   text,
  contact_email  text,
  work_phone     text,
  mobile_phone   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Admin permission for unified content application queue (Faz A+)
INSERT INTO admin_permissions (user_id, permission)
SELECT u.id, 'review_content_applications'
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role_id IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR')
  AND NOT EXISTS (
    SELECT 1 FROM admin_permissions ap
    WHERE ap.user_id = u.id AND ap.permission = 'review_content_applications'
  );

-- Journal ID sequence sync (Faz B öncesi doğrulama; journals.id legacy BigInt)
DO $$
DECLARE
  seq_name text;
  max_id bigint;
BEGIN
  SELECT pg_get_serial_sequence('journals', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX(id), 1) INTO max_id FROM journals;
    PERFORM setval(seq_name, GREATEST(max_id, 1), true);
  END IF;
END $$;
