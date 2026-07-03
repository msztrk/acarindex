-- RBAC Faz 1–2: journal/institution memberships, admin_permissions, change requests
-- Idempotent where practical; no breaking changes to users/sessions/credentials.

-- Enums
DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE journal_membership_role AS ENUM ('journal_owner', 'journal_editor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE institution_membership_role AS ENUM ('institution_manager', 'institution_viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE membership_application_type AS ENUM ('journal_editor', 'institution_manager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE change_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Deprecate global EDITOR role description (no rename, no auto journal membership)
UPDATE roles
SET description = 'DEPRECATED: Genel admin erişimi (legacy_admin_access). Dergi editörlüğü yalnızca journal_memberships üzerinden verilir.'
WHERE id = 'EDITOR';

-- Institutions
CREATE TABLE IF NOT EXISTS institutions (
  id            bigserial PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  name_tr       text NOT NULL,
  name_en       text,
  email_domain  text,
  website       text,
  logo_url      text,
  is_active     boolean NOT NULL DEFAULT true,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutions_is_active ON institutions (is_active);

-- Journal memberships
CREATE TABLE IF NOT EXISTS journal_memberships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id   bigint NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  role         journal_membership_role NOT NULL,
  status       membership_status NOT NULL DEFAULT 'pending',
  invited_by   uuid,
  approved_by  uuid,
  approved_at  timestamptz,
  suspended_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, journal_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_memberships_journal_status ON journal_memberships (journal_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_memberships_user_status ON journal_memberships (user_id, status);

-- Institution memberships
CREATE TABLE IF NOT EXISTS institution_memberships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id bigint NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role           institution_membership_role NOT NULL,
  status         membership_status NOT NULL DEFAULT 'pending',
  invited_by     uuid,
  approved_by    uuid,
  approved_at    timestamptz,
  suspended_at   timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_institution_memberships_institution_status ON institution_memberships (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_institution_memberships_user_status ON institution_memberships (user_id, status);

-- Admin permissions (DB-driven)
CREATE TABLE IF NOT EXISTS admin_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission  text NOT NULL,
  granted_by  uuid,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  UNIQUE (user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_user ON admin_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_permission ON admin_permissions (permission);

-- Membership applications
CREATE TABLE IF NOT EXISTS membership_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           membership_application_type NOT NULL,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id     bigint REFERENCES journals(id) ON DELETE CASCADE,
  institution_id bigint REFERENCES institutions(id) ON DELETE CASCADE,
  payload        jsonb,
  status         application_status NOT NULL DEFAULT 'pending',
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_applications_journal_required
    CHECK (type <> 'journal_editor' OR journal_id IS NOT NULL),
  CONSTRAINT membership_applications_institution_required
    CHECK (type <> 'institution_manager' OR institution_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_membership_applications_user_status ON membership_applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_applications_journal_status ON membership_applications (journal_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_applications_institution_status ON membership_applications (institution_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS membership_applications_pending_journal_uniq
  ON membership_applications (user_id, journal_id, type)
  WHERE status = 'pending' AND journal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS membership_applications_pending_institution_uniq
  ON membership_applications (user_id, institution_id, type)
  WHERE status = 'pending' AND institution_id IS NOT NULL;

-- Change requests
CREATE TABLE IF NOT EXISTS change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_type  text NOT NULL,
  old_data     jsonb,
  new_data     jsonb,
  status       change_request_status NOT NULL DEFAULT 'pending',
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_entity ON change_requests (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester_status ON change_requests (requested_by, status);
CREATE INDEX IF NOT EXISTS idx_change_requests_status_created ON change_requests (status, created_at DESC);

-- Audit log extensions (nullable, backward compatible)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- Backfill admin_permissions from global roles (idempotent)
-- SUPER_ADMIN: all permissions
INSERT INTO admin_permissions (user_id, permission)
SELECT ur.user_id, p.permission
FROM user_roles ur
CROSS JOIN (
  VALUES
    ('manage_users'),
    ('manage_roles'),
    ('manage_journals'),
    ('manage_institutions'),
    ('manage_articles'),
    ('manage_pdfs'),
    ('review_change_requests'),
    ('view_audit_logs'),
    ('manage_system_settings'),
    ('legacy_admin_access')
) AS p(permission)
WHERE ur.role_id = 'SUPER_ADMIN'
ON CONFLICT (user_id, permission) DO UPDATE SET revoked_at = NULL;

-- ADMIN
INSERT INTO admin_permissions (user_id, permission)
SELECT ur.user_id, p.permission
FROM user_roles ur
CROSS JOIN (
  VALUES
    ('manage_users'),
    ('manage_roles'),
    ('manage_journals'),
    ('manage_institutions'),
    ('manage_articles'),
    ('manage_pdfs'),
    ('review_change_requests'),
    ('view_audit_logs')
) AS p(permission)
WHERE ur.role_id = 'ADMIN'
ON CONFLICT (user_id, permission) DO UPDATE SET revoked_at = NULL;

-- MODERATOR
INSERT INTO admin_permissions (user_id, permission)
SELECT ur.user_id, p.permission
FROM user_roles ur
CROSS JOIN (
  VALUES
    ('manage_journals'),
    ('manage_articles'),
    ('manage_pdfs'),
    ('review_change_requests'),
    ('view_audit_logs')
) AS p(permission)
WHERE ur.role_id = 'MODERATOR'
ON CONFLICT (user_id, permission) DO UPDATE SET revoked_at = NULL;

-- EDITOR: legacy_admin_access only (NOT journal membership)
INSERT INTO admin_permissions (user_id, permission)
SELECT ur.user_id, 'legacy_admin_access'
FROM user_roles ur
WHERE ur.role_id = 'EDITOR'
ON CONFLICT (user_id, permission) DO UPDATE SET revoked_at = NULL;
