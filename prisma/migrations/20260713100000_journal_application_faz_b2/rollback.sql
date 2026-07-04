-- Faz B2 rollback — duplicate precheck columns

ALTER TABLE journal_applications
  DROP COLUMN IF EXISTS duplicate_continue_reason,
  DROP COLUMN IF EXISTS duplicate_flags;
