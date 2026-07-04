-- Faz B2: journal application submit validation (duplicate flags + continue reason)

ALTER TABLE journal_applications
  ADD COLUMN IF NOT EXISTS duplicate_flags jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_continue_reason text;
