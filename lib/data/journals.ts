import { prisma } from '@/lib/db/prisma'
import { ISSUE_ARTICLES_MAX } from './constants'
import { mapIssue, mapJournal } from './serialize'

export async function listJournalsPaginated(options: {
  categoryId?: number
  q?: string
  page: number
  perPage: number
}) {
  const { categoryId, q, page, perPage } = options
  const where = {
    status: 'published' as const,
    ...(categoryId ? { categoryId: BigInt(categoryId) } : {}),
    ...(q ? { titleTr: { contains: q, mode: 'insensitive' as const } } : {}),
  }
  const [rows, total] = await prisma.$transaction([
    prisma.journal.findMany({
      where,
      orderBy: { titleTr: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        slug: true,
        titleTr: true,
        titleEn: true,
        issn: true,
        eissn: true,
        publisher: true,
        frequency: true,
        coverPath: true,
        hitCount: true,
        categoryId: true,
      },
    }),
    prisma.journal.count({ where }),
  ])
  return {
    journals: rows.map((r) => ({
      id: Number(r.id),
      slug: r.slug,
      title_tr: r.titleTr,
      title_en: r.titleEn,
      issn: r.issn,
      eissn: r.eissn,
      publisher: r.publisher,
      frequency: r.frequency,
      cover_path: r.coverPath,
      hit_count: r.hitCount,
      category_id: r.categoryId ? Number(r.categoryId) : null,
    })),
    total,
  }
}

export async function getPublishedJournalById(journalId: number) {
  const row = await prisma.journal.findFirst({
    where: { id: BigInt(journalId), status: 'published' },
  })
  return row ? mapJournal(row) : null
}

export async function listPublishedIssuesForJournal(journalId: number) {
  const rows = await prisma.issue.findMany({
    where: { journalId: BigInt(journalId), status: 'published' },
    orderBy: { year: 'desc' },
  })
  return rows.map(mapIssue)
}

export async function getPublishedIssueById(issueId: number) {
  const row = await prisma.issue.findFirst({
    where: { id: BigInt(issueId), status: 'published' },
  })
  return row ? mapIssue(row) : null
}

export async function listArticlesForIssue(issueId: number) {
  const rows = await prisma.article.findMany({
    where: { issueId: BigInt(issueId), status: 'published' },
    orderBy: { pageStart: 'asc' },
    take: ISSUE_ARTICLES_MAX,
    select: {
      id: true,
      slug: true,
      legacyJournalSlug: true,
      titleTr: true,
      titleEn: true,
      authorsRaw: true,
      pageStart: true,
      pageEnd: true,
      publishedYear: true,
    },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    legacy_journal_slug: r.legacyJournalSlug,
    title_tr: r.titleTr,
    title_en: r.titleEn,
    authors_raw: r.authorsRaw,
    page_start: r.pageStart,
    page_end: r.pageEnd,
    published_year: r.publishedYear,
  }))
}

export async function countArticlesForIssue(issueId: number) {
  return prisma.article.count({
    where: { issueId: BigInt(issueId), status: 'published' },
  })
}

export async function listLatestArticlesForJournal(journalId: number, limit = 10) {
  const rows = await prisma.article.findMany({
    where: { journalId: BigInt(journalId), status: 'published' },
    orderBy: { publishedYear: 'desc' },
    take: limit,
    select: {
      id: true,
      slug: true,
      legacyJournalSlug: true,
      titleTr: true,
      titleEn: true,
      authorsRaw: true,
      publishedYear: true,
      issueId: true,
    },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    legacy_journal_slug: r.legacyJournalSlug,
    title_tr: r.titleTr,
    title_en: r.titleEn,
    authors_raw: r.authorsRaw,
    published_year: r.publishedYear,
    issue_id: r.issueId ? Number(r.issueId) : null,
  }))
}

export async function listJournalsForSitemap(limit: number) {
  const rows = await prisma.journal.findMany({
    where: { status: 'published' },
    orderBy: { id: 'asc' },
    take: limit,
    select: { id: true, slug: true, updatedAt: true },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    updated_at: r.updatedAt.toISOString(),
  }))
}
