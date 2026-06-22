/**
 * Katalog okuma — Prisma (standart PostgreSQL).
 */
import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@prisma/client'

export function bigintToNumber(v: bigint | number | null | undefined): number | null {
  if (v == null) return null
  return typeof v === 'bigint' ? Number(v) : v
}

export async function listRecentArticles(limit = 8) {
  const rows = await prisma.article.findMany({
    where: { status: 'published' },
    orderBy: { id: 'desc' },
    take: limit,
    select: {
      id: true,
      slug: true,
      legacyJournalSlug: true,
      titleTr: true,
      titleEn: true,
      authorsRaw: true,
      publishedYear: true,
      journal: { select: { id: true, slug: true, titleTr: true } },
    },
  })
  return rows.map((r) => ({
    id: bigintToNumber(r.id)!,
    slug: r.slug,
    legacy_journal_slug: r.legacyJournalSlug,
    title_tr: r.titleTr,
    title_en: r.titleEn,
    authors_raw: r.authorsRaw,
    published_year: r.publishedYear,
    journal: r.journal
      ? {
          id: bigintToNumber(r.journal.id)!,
          slug: r.journal.slug,
          title_tr: r.journal.titleTr,
        }
      : null,
  }))
}

export async function listFeaturedJournals(limit = 6) {
  const rows = await prisma.journal.findMany({
    where: { status: 'published' },
    orderBy: { hitCount: 'desc' },
    take: limit,
    select: { id: true, slug: true, titleTr: true, issn: true, hitCount: true },
  })
  return rows.map((r) => ({
    id: bigintToNumber(r.id)!,
    slug: r.slug,
    title_tr: r.titleTr,
    issn: r.issn,
    hit_count: r.hitCount,
  }))
}

export async function listActiveCategories() {
  const rows = await prisma.category.findMany({
    where: { active: true },
    orderBy: { nameTr: 'asc' },
    select: { id: true, nameTr: true, nameEn: true },
  })
  return rows.map((r) => ({
    id: bigintToNumber(r.id)!,
    name_tr: r.nameTr,
    name_en: r.nameEn,
  }))
}

export async function getPublishedJournalById(id: number) {
  const row = await prisma.journal.findFirst({
    where: { id: BigInt(id), status: 'published' },
  })
  if (!row) return null
  return serializeJournal(row)
}

export async function getPublishedArticleByPath(
  legacyJournalSlug: string,
  slug: string,
  id: number,
) {
  const row = await prisma.article.findFirst({
    where: {
      id: BigInt(id),
      slug,
      legacyJournalSlug,
      status: 'published',
    },
    include: {
      journal: true,
      issue: true,
      pdfFile: true,
    },
  })
  if (!row) return null
  return serializeArticle(row)
}

function serializeJournal(row: Prisma.JournalGetPayload<object>) {
  return {
    ...row,
    id: bigintToNumber(row.id)!,
    legacy_id: bigintToNumber(row.legacyId),
    category_id: bigintToNumber(row.categoryId),
    title_tr: row.titleTr,
    title_en: row.titleEn,
    hit_count: row.hitCount,
  }
}

function serializeArticle(
  row: Prisma.ArticleGetPayload<{ include: { journal: true; issue: true; pdfFile: true } }>,
) {
  return {
    id: bigintToNumber(row.id)!,
    legacy_id: bigintToNumber(row.legacyId),
    slug: row.slug,
    legacy_journal_slug: row.legacyJournalSlug,
    journal_id: bigintToNumber(row.journalId)!,
    issue_id: bigintToNumber(row.issueId),
    title_tr: row.titleTr,
    title_en: row.titleEn,
    authors_raw: row.authorsRaw,
    authors_citation: row.authorsCitation,
    institution_raw: row.institutionRaw,
    abstract_tr: row.abstractTr,
    abstract_en: row.abstractEn,
    keywords_tr: row.keywordsTr,
    keywords_en: row.keywordsEn,
    page_start: row.pageStart,
    page_end: row.pageEnd,
    published_year: row.publishedYear,
    published_at: row.publishedAt,
    doi: row.doi,
    hit_count: row.hitCount,
    download_count: row.downloadCount,
    status: row.status,
    journal: row.journal ? serializeJournal(row.journal) : null,
    issue: row.issue
      ? {
          id: bigintToNumber(row.issue.id)!,
          year: row.issue.year,
          issue_number: row.issue.issueNumber,
          issue_label: row.issue.issueLabel,
        }
      : null,
    pdf_file: row.pdfFile
      ? {
          id: row.pdfFile.id,
          legacy_pdf_path: row.pdfFile.legacyPdfPath,
          file_status: row.pdfFile.fileStatus,
        }
      : null,
  }
}
