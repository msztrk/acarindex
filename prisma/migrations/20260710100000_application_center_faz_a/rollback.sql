-- Rollback Faz A application center (isolated rehearsal only)

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
