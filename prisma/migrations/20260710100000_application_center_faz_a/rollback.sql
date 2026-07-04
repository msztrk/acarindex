-- Rollback Faz A application center (isolated rehearsal only — NOT for production pilot DB)
--
-- LIMITATIONS (read before use):
-- - Drops all Faz A tables and permanently deletes every row in:
--   content_applications, application_revisions, application_events,
--   application_reviews, application_attachments, application_private_contacts.
-- - Does NOT restore approved, published, or in-flight content that lived only in
--   those tables; rollback is schema teardown, not content undo.
-- - Does NOT touch auth/RBAC core tables (users, sessions, user_roles, etc.).
-- - Re-applying migration.sql recreates empty Faz A schema; prior application data
--   is gone unless restored from a pre-migration pg_dump backup.

DROP TABLE IF EXISTS application_private_contacts CASCADE;
DROP TABLE IF EXISTS application_attachments CASCADE;
DROP TABLE IF EXISTS application_reviews CASCADE;
DROP TABLE IF EXISTS application_events CASCADE;

ALTER TABLE IF EXISTS content_applications
  DROP CONSTRAINT IF EXISTS content_applications_reviewed_revision_id_fkey;

DROP TABLE IF EXISTS application_revisions CASCADE;
DROP TABLE IF EXISTS content_applications CASCADE;

DELETE FROM admin_permissions WHERE permission = 'review_content_applications';

DROP TYPE IF EXISTS application_attachment_upload_status;
DROP TYPE IF EXISTS application_attachment_kind;
DROP TYPE IF EXISTS application_revision_submission_type;
DROP TYPE IF EXISTS content_application_status;
DROP TYPE IF EXISTS content_application_kind;
