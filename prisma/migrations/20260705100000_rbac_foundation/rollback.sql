-- Rollback rehearsal for 20260705100000_rbac_foundation
-- Run manually on staging only; drops RBAC tables added in Faz 1–2.
-- Does NOT remove audit_logs columns (nullable; harmless if left).

DROP TABLE IF EXISTS change_requests CASCADE;
DROP TABLE IF EXISTS membership_applications CASCADE;
DROP TABLE IF EXISTS admin_permissions CASCADE;
DROP TABLE IF EXISTS institution_memberships CASCADE;
DROP TABLE IF EXISTS journal_memberships CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

DROP TYPE IF EXISTS change_request_status;
DROP TYPE IF EXISTS application_status;
DROP TYPE IF EXISTS membership_application_type;
DROP TYPE IF EXISTS institution_membership_role;
DROP TYPE IF EXISTS journal_membership_role;
DROP TYPE IF EXISTS membership_status;

UPDATE roles
SET description = 'İçerik düzenleme'
WHERE id = 'EDITOR';
