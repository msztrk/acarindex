/**
 * AcarIndex Supabase veritabanı tipleri
 *
 * Gerçek tipler `supabase gen types` ile üretilecek.
 * Bu dosya ETL tamamlanana kadar manuel placeholder.
 *
 * Kullanım:
 *   supabase gen types typescript --project-id <id> > types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      categories:            { Row: Category;           Insert: Partial<Category>;           Update: Partial<Category> }
      journals:              { Row: Journal;             Insert: Partial<Journal>;             Update: Partial<Journal> }
      issues:                { Row: Issue;               Insert: Partial<Issue>;               Update: Partial<Issue> }
      articles:              { Row: Article;             Insert: Partial<Article>;             Update: Partial<Article> }
      pdf_files:             { Row: PdfFile;             Insert: Partial<PdfFile>;             Update: Partial<PdfFile> }
      authors:               { Row: Author;              Insert: Partial<Author>;              Update: Partial<Author> }
      article_authors:       { Row: ArticleAuthor;       Insert: Partial<ArticleAuthor>;       Update: Partial<ArticleAuthor> }
      institutions:          { Row: Institution;         Insert: Partial<Institution>;         Update: Partial<Institution> }
      article_institutions:  { Row: ArticleInstitution;  Insert: Partial<ArticleInstitution>;  Update: Partial<ArticleInstitution> }
      keywords:              { Row: Keyword;             Insert: Partial<Keyword>;             Update: Partial<Keyword> }
      article_keywords:      { Row: ArticleKeyword;      Insert: Partial<ArticleKeyword>;      Update: Partial<ArticleKeyword> }
      user_profiles:         { Row: UserProfile;         Insert: Partial<UserProfile>;         Update: Partial<UserProfile> }
      user_favorites:        { Row: UserFavorite;        Insert: Partial<UserFavorite>;        Update: Partial<UserFavorite> }
      journal_applications:  { Row: JournalApplication;  Insert: Partial<JournalApplication>;  Update: Partial<JournalApplication> }
      url_aliases:           { Row: UrlAlias;            Insert: Partial<UrlAlias>;            Update: Partial<UrlAlias> }
    }
    Views: {
      platform_stats: { Row: PlatformStats }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ── Entity types ──────────────────────────────────────────────────────────────

export interface Category {
  id: number
  legacy_id: number | null
  name_tr: string | null
  name_en: string | null
  slug: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Journal {
  id: number
  legacy_id: number | null
  slug: string

  title_tr: string | null
  title_en: string | null
  old_name: string | null

  issn: string | null
  eissn: string | null

  publisher: string | null
  frequency: string | null
  start_year: string | null
  publication_format: string | null
  publish_language: string | null
  subject_category: string | null
  topics: string | null

  editor_in_chief: string | null
  editorial_board: string | null
  colophon: string | null

  description: string | null
  about: string | null
  aim_and_scope: string | null

  policy: string | null
  writing_rules: string | null
  price_policy: string | null

  indexes_text: string | null
  years_indexed: string | null

  contact_text: string | null
  contact_json: Json | null

  cover_path: string | null
  legacy_link: string | null

  category_id: number | null
  status: 'published' | 'draft' | 'archived'
  hit_count: number
  created_at: string
  updated_at: string
}

export interface Issue {
  id: number
  legacy_id: number | null
  journal_id: number
  year: number | null
  issue_number: string | null
  volume: string | null
  issue_label: string | null
  dergipark_issue_id: number | null
  status: 'published' | 'draft' | 'archived'
  hit_count: number
  created_at: string
  updated_at: string
}

export interface Article {
  id: number
  legacy_id: number | null
  slug: string
  legacy_journal_slug: string

  journal_id: number
  issue_id: number | null

  title_tr: string | null
  title_en: string | null

  authors_raw: string | null
  authors_citation: string | null
  legacy_author_ids: string | null
  institution_raw: string | null

  abstract_tr: string | null
  abstract_en: string | null

  keywords_tr: string | null
  keywords_en: string | null

  references_raw: string | null
  citation_format: string | null

  page_start: number | null
  page_end: number | null

  published_at: string | null
  published_year: number | null
  submission_dates: string | null

  language: string | null
  document_language: string | null
  document_type: string | null
  article_type: string | null
  access_type: string | null
  section: string | null
  subject_area: string | null

  doi: string | null
  dergipark_issue_id: number | null

  hit_count: number
  download_count: number
  status: 'published' | 'draft' | 'review' | 'archived'

  created_at: string
  updated_at: string
}

export interface PdfFile {
  id: string
  article_id: number
  legacy_pdf_path: string | null
  storage_key: string | null
  cdn_url: string | null
  file_size_bytes: number | null
  page_count: number | null
  checksum_sha256: string | null
  file_status: 'legacy' | 'available' | 'missing' | 'migrated'
  created_at: string
  updated_at: string
}

export interface Author {
  id: number
  legacy_id: number | null
  slug: string | null
  name: string
  title: string | null
  institution: string | null
  bio: string | null
  orcid: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export interface ArticleAuthor {
  article_id: number
  author_id: number
  position: number | null
  raw_name: string | null
}

export interface Institution {
  id: number
  legacy_id: number | null
  name: string
  name_en: string | null
  email_list: string | null
  slug: string | null
  country: string | null
  city: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export interface ArticleInstitution {
  article_id: number
  institution_id: number
  author_id: number | null
  raw_name: string | null
}

export interface Keyword {
  id: number
  text_tr: string | null
  text_en: string | null
  slug: string | null
  language: string | null
}

export interface ArticleKeyword {
  article_id: number
  keyword_id: number
  language: string | null
  raw_text: string | null
}

export interface UserProfile {
  id: string              // UUID — Supabase Auth
  legacy_id: number | null
  first_name: string | null
  last_name: string | null
  full_name: string | null  // GENERATED
  title: string | null
  institution: string | null
  orcid: string | null
  phone: string | null
  country_id: number | null
  membership_type: number | null
  email_verified: boolean
  preferred_language: string | null
  notification_email: boolean
  created_at: string
  updated_at: string
}

export interface UserFavorite {
  user_id: string
  article_id: number
  created_at: string
}

export interface JournalApplication {
  id: number
  legacy_id: number | null
  journal_name_tr: string
  journal_name_en: string | null
  journal_abbr: string | null
  institution_name: string | null
  journal_type: string | null
  platform: string | null
  website: string | null
  issn: string | null
  frequency: string | null
  years_active: string | null
  publication_months: string | null
  address: string | null
  subject_areas: string | null
  keywords_raw: string | null
  article_count_range: string | null
  editor_name: string | null
  editor_email: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_mobile: string | null
  cover_path: string | null
  applicant_legacy_user_id: number | null
  applicant_user_id: string | null
  status: 'pending' | 'approved' | 'rejected' | 'info_requested'
  reviewer_notes: string | null
  reviewed_at: string | null
  approved_journal_id: number | null
  created_at: string
  updated_at: string
}

export interface UrlAlias {
  legacy_path: string
  canonical_path: string
  entity_type: string | null
  entity_id: number | null
  http_status: number
  created_at: string
}

export interface PlatformStats {
  journal_count: number
  article_count: number
  pdf_count: number
  total_hits: number
  author_count: number
  institution_count: number
  refreshed_at: string
}
