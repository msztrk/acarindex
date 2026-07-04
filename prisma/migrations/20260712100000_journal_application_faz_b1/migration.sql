-- Faz B1: Yeni dergi başvurusu domain foundation

DO $$ BEGIN
  CREATE TYPE journal_application_subject_level AS ENUM ('primary', 'secondary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE publication_frequency AS ENUM (
    'monthly', 'bimonthly', 'quarterly', 'four_monthly',
    'semiannual', 'annual', 'continuous', 'irregular'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE content_applications
  ADD COLUMN IF NOT EXISTS approved_journal_id bigint REFERENCES journals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_applications_approved_journal
  ON content_applications (approved_journal_id);

CREATE TABLE IF NOT EXISTS journal_applications (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_application_id    uuid NOT NULL UNIQUE REFERENCES content_applications(id) ON DELETE CASCADE,
  name_tr                   text,
  name_en                   text,
  abbreviation              text,
  publisher_institution_id  bigint REFERENCES institutions(id) ON DELETE SET NULL,
  proposed_institution_name text,
  journal_type              text,
  publishing_platform       text,
  website_url               text,
  p_issn                    text,
  e_issn                    text,
  p_issn_normalized         text,
  e_issn_normalized         text,
  first_publication_year    int,
  publication_frequency     publication_frequency,
  publication_months        int[] NOT NULL DEFAULT '{}',
  correspondence_address    text,
  editor_name               text,
  editor_title              text,
  editor_email              text,
  editor_orcid              text,
  editor_profile_url        text,
  official_journal_url      text,
  editorial_board_url       text,
  latest_issue_url          text,
  platform_profile_url      text,
  publisher_page_url        text,
  keywords                  text[] NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_applications_publisher_institution
  ON journal_applications (publisher_institution_id);
CREATE INDEX IF NOT EXISTS idx_journal_applications_p_issn_normalized
  ON journal_applications (p_issn_normalized);
CREATE INDEX IF NOT EXISTS idx_journal_applications_e_issn_normalized
  ON journal_applications (e_issn_normalized);

CREATE TABLE IF NOT EXISTS journal_application_subject_areas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_application_id uuid NOT NULL REFERENCES journal_applications(id) ON DELETE CASCADE,
  category_id            bigint NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  level                  journal_application_subject_level NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_application_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_app_subject_areas_app
  ON journal_application_subject_areas (journal_application_id);
CREATE INDEX IF NOT EXISTS idx_journal_app_subject_areas_category
  ON journal_application_subject_areas (category_id);

CREATE TABLE IF NOT EXISTS application_declaration_acceptances (
  journal_application_id             uuid PRIMARY KEY REFERENCES journal_applications(id) ON DELETE CASCADE,
  criteria_version                     text,
  criteria_accepted_at                 timestamptz,
  standards_version                    text,
  standards_accepted_at                timestamptz,
  privacy_notice_version               text,
  privacy_notice_accepted_at           timestamptz,
  image_rights_version                 text,
  image_rights_accepted_at             timestamptz,
  information_accuracy_version         text,
  information_accuracy_confirmed_at  timestamptz,
  created_at                           timestamptz NOT NULL DEFAULT now(),
  updated_at                           timestamptz NOT NULL DEFAULT now()
);
