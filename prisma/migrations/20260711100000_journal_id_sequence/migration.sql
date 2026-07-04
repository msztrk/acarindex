-- Pre-Faz-B: journals.id default via dedicated sequence (BigInt PK, ETL may still set explicit ids).

CREATE SEQUENCE IF NOT EXISTS journals_id_seq;

SELECT setval(
  'journals_id_seq',
  (SELECT COALESCE(MAX(id), 1) FROM journals),
  true
);

ALTER TABLE journals
  ALTER COLUMN id SET DEFAULT nextval('journals_id_seq');

ALTER SEQUENCE journals_id_seq OWNED BY journals.id;
