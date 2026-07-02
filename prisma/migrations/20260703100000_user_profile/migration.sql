-- Üye profil alanları (genel bilgiler)
CREATE TABLE user_profiles (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name     text,
  last_name      text,
  institution    text,
  science_field  text,
  interest_areas text[] NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);
