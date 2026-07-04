-- Rollback journals_id_seq default; existing journal rows keep their ids.

ALTER TABLE journals ALTER COLUMN id DROP DEFAULT;

DROP SEQUENCE IF EXISTS journals_id_seq;
