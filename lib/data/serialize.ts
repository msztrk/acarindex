import type { Prisma } from '@prisma/client'
import type { Article, Author, Issue, Journal, PdfFile } from '@/types/database'

export function bn(v: bigint | number | null | undefined): number | null {
  if (v == null) return null
  return typeof v === 'bigint' ? Number(v) : v
}

export function mapJournal(row: Prisma.JournalGetPayload<object>): Journal {
  return {
    id: bn(row.id)!,
    legacy_id: bn(row.legacyId),
    slug: row.slug,
    slug_tr: row.slugTr ?? row.slug,
    slug_en: row.slugEn,
    has_en_content: row.hasEnContent,
    title_tr: row.titleTr,
    title_en: row.titleEn,
    old_name: row.oldName,
    issn: row.issn,
    eissn: row.eissn,
    publisher: row.publisher,
    frequency: row.frequency,
    start_year: row.startYear,
    publication_format: row.publicationFormat,
    publish_language: row.publishLanguage,
    subject_category: row.subjectCategory,
    topics: row.topics,
    editor_in_chief: row.editorInChief,
    editorial_board: row.editorialBoard,
    colophon: row.colophon,
    description: row.description,
    about: row.about,
    aim_and_scope: row.aimAndScope,
    policy: row.policy,
    writing_rules: row.writingRules,
    price_policy: row.pricePolicy,
    indexes_text: row.indexesText,
    years_indexed: row.yearsIndexed,
    contact_text: row.contactText,
    contact_json: row.contactJson as Journal['contact_json'],
    cover_path: row.coverPath,
    legacy_link: row.legacyLink,
    category_id: bn(row.categoryId),
    status: row.status as Journal['status'],
    hit_count: row.hitCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export function mapIssue(row: Prisma.IssueGetPayload<object>): Issue {
  return {
    id: bn(row.id)!,
    legacy_id: bn(row.legacyId),
    journal_id: bn(row.journalId)!,
    year: row.year,
    issue_number: row.issueNumber,
    volume: row.volume,
    issue_label: row.issueLabel,
    dergipark_issue_id: bn(row.dergiparkIssueId),
    status: row.status as Issue['status'],
    hit_count: row.hitCount,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export function mapArticle(
  row: Prisma.ArticleGetPayload<object>,
): Article {
  return {
    id: bn(row.id)!,
    legacy_id: bn(row.legacyId),
    slug: row.slug,
    slug_tr: row.slugTr ?? row.slug,
    slug_en: row.slugEn,
    has_en_content: row.hasEnContent,
    legacy_journal_slug: row.legacyJournalSlug,
    legacy_journal_slug_en: row.legacyJournalSlugEn,
    journal_id: bn(row.journalId)!,
    issue_id: bn(row.issueId),
    title_tr: row.titleTr,
    title_en: row.titleEn,
    authors_raw: row.authorsRaw,
    authors_citation: row.authorsCitation,
    legacy_author_ids: row.legacyAuthorIds,
    institution_raw: row.institutionRaw,
    abstract_tr: row.abstractTr,
    abstract_en: row.abstractEn,
    keywords_tr: row.keywordsTr,
    keywords_en: row.keywordsEn,
    references_raw: row.referencesRaw,
    citation_format: row.citationFormat,
    page_start: row.pageStart,
    page_end: row.pageEnd,
    published_at: row.publishedAt?.toISOString().slice(0, 10) ?? null,
    published_year: row.publishedYear,
    submission_dates: row.submissionDates,
    language: row.language,
    document_language: row.documentLanguage,
    document_type: row.documentType,
    article_type: row.articleType,
    access_type: row.accessType,
    section: row.section,
    subject_area: row.subjectArea,
    doi: row.doi,
    dergipark_issue_id: bn(row.dergiparkIssueId),
    hit_count: row.hitCount,
    download_count: row.downloadCount,
    status: row.status as Article['status'],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export function mapAuthor(row: Prisma.AuthorGetPayload<object>): Author {
  return {
    id: bn(row.id)!,
    legacy_id: bn(row.legacyId),
    slug: row.slug,
    name: row.name,
    title: row.title,
    institution: row.institution,
    bio: row.bio,
    orcid: row.orcid,
    email: row.email,
    is_provisional: row.isProvisional,
    source_key: row.sourceKey,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export function mapPdfFile(row: Prisma.PdfFileGetPayload<object>): PdfFile {
  return {
    id: row.id,
    article_id: bn(row.articleId)!,
    legacy_pdf_path: row.legacyPdfPath,
    storage_key: row.storageKey,
    cdn_url: row.cdnUrl,
    file_size_bytes: bn(row.fileSizeBytes),
    page_count: row.pageCount,
    checksum_sha256: row.checksumSha256,
    file_status: row.fileStatus as PdfFile['file_status'],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
