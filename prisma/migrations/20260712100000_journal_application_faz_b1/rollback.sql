-- Faz B1 rollback — journal application tables and content_applications.approved_journal_id

DROP TABLE IF EXISTS application_declaration_acceptances;
DROP TABLE IF EXISTS journal_application_subject_areas;
DROP TABLE IF EXISTS journal_applications;

ALTER TABLE content_applications DROP COLUMN IF EXISTS approved_journal_id;

DROP TYPE IF EXISTS publication_frequency;
DROP TYPE IF EXISTS journal_application_subject_level;
