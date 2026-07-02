import { prisma } from '@/lib/db/prisma'
import { mapArticle, mapAuthor, mapJournal, mapPdfFile } from './serialize'

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
    include: { journal: true, issue: true, pdfFile: true },
  })
  if (!row) return null
  return {
    article: mapArticle(row),
    journal: row.journal ? mapJournal(row.journal) : null,
    issue: row.issue
      ? {
          id: Number(row.issue.id),
          year: row.issue.year,
          issue_number: row.issue.issueNumber,
          issue_label: row.issue.issueLabel,
        }
      : null,
    pdf: row.pdfFile ? mapPdfFile(row.pdfFile) : null,
  }
}

export async function listArticleAuthorsForArticle(articleId: number) {
  const rows = await prisma.articleAuthor.findMany({
    where: { articleId: BigInt(articleId) },
    orderBy: { authorPosition: 'asc' },
    include: { author: true },
  })
  return rows.map((r) => ({
    author_position: r.authorPosition,
    raw_author_name: r.rawAuthorName,
    author: r.author ? mapAuthor(r.author) : null,
  }))
}

export async function getPublishedArticleDetailById(articleId: number) {
  const row = await prisma.article.findFirst({
    where: { id: BigInt(articleId), status: 'published' },
    include: {
      journal: {
        select: {
          id: true,
          slug: true,
          titleTr: true,
          titleEn: true,
          issn: true,
          eissn: true,
          publisher: true,
          coverPath: true,
        },
      },
      issue: {
        select: {
          id: true,
          year: true,
          issueLabel: true,
          volume: true,
          issueNumber: true,
        },
      },
      pdfFile: {
        select: { legacyPdfPath: true, fileStatus: true, cdnUrl: true },
      },
    },
  })
  if (!row) return null
  const article = mapArticle(row)
  return {
    ...article,
    journal: row.journal
      ? {
          id: Number(row.journal.id),
          slug: row.journal.slug,
          title_tr: row.journal.titleTr,
          title_en: row.journal.titleEn,
          issn: row.journal.issn,
          eissn: row.journal.eissn,
          publisher: row.journal.publisher,
          cover_path: row.journal.coverPath,
        }
      : null,
    issue: row.issue
      ? {
          id: Number(row.issue.id),
          year: row.issue.year,
          issue_label: row.issue.issueLabel,
          volume: row.issue.volume,
          issue_number: row.issue.issueNumber,
        }
      : null,
    pdf: row.pdfFile
      ? {
          legacy_pdf_path: row.pdfFile.legacyPdfPath,
          file_status: row.pdfFile.fileStatus,
          cdn_url: row.pdfFile.cdnUrl,
        }
      : null,
  }
}

export async function getPublishedArticleWithJournal(articleId: number) {
  const row = await prisma.article.findFirst({
    where: { id: BigInt(articleId), status: 'published' },
    include: { journal: true },
  })
  if (!row) return null
  return {
    article: mapArticle(row),
    journal: row.journal ? mapJournal(row.journal) : null,
  }
}

export async function listArticlesForSitemapPage(page: number, perPage: number) {
  const rows = await prisma.article.findMany({
    where: { status: 'published' },
    orderBy: { id: 'asc' },
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      slug: true,
      slugTr: true,
      slugEn: true,
      legacyJournalSlug: true,
      legacyJournalSlugEn: true,
      updatedAt: true,
    },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    slug_tr: r.slugTr ?? r.slug,
    slug_en: r.slugEn,
    legacy_journal_slug: r.legacyJournalSlug,
    legacy_journal_slug_en: r.legacyJournalSlugEn,
    updated_at: r.updatedAt.toISOString(),
  }))
}

export async function countPublishedArticles() {
  return prisma.article.count({ where: { status: 'published' } })
}

export async function suggestArticles(q: string, limit = 5) {
  const rows = await prisma.article.findMany({
    where: {
      status: 'published',
      OR: [
        { titleTr: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: limit,
    select: {
      id: true,
      titleTr: true,
      titleEn: true,
      slug: true,
      legacyJournalSlug: true,
      publishedYear: true,
    },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    title_tr: r.titleTr,
    title_en: r.titleEn,
    slug: r.slug,
    legacy_journal_slug: r.legacyJournalSlug,
    published_year: r.publishedYear,
  }))
}
