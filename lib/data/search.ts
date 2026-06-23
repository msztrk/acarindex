import { prisma } from '@/lib/db/prisma'
import { mapPdfFile } from './serialize'
import { expandSearchTerms } from '@/lib/search/normalize'

type SearchArea = 'all' | 'title' | 'author' | 'keywords'

export interface PrismaSearchParams {
  q: string
  area: SearchArea
  language?: 'tr' | 'en'
  journalId?: number
  yearFrom?: number
  yearTo?: number
  page: number
  perPage: number
}

export interface ArticleResult {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  authors_raw: string | null
  keywords_tr: string | null
  published_year: number | null
  journal_title: string | null
  journal_slug: string | null
  journal_id: number | null
}

export interface JournalResult {
  id: number
  slug: string
  title_tr: string | null
  title_en: string | null
  issn: string | null
  publisher: string | null
}

export interface AuthorResult {
  id: number
  slug: string | null
  name: string
}

export async function searchArticlesPrisma(
  params: PrismaSearchParams,
): Promise<{ data: ArticleResult[]; total: number }> {
  const { q, area, language, journalId, yearFrom, yearTo, page, perPage } = params
  const terms = expandSearchTerms(q)
  const offset = (page - 1) * perPage

  const textOr: Record<string, unknown>[] = []
  if (terms.length) {
    for (const term of terms) {
      if (area === 'title' || area === 'all') {
        textOr.push({ titleTr: { contains: term, mode: 'insensitive' } })
        textOr.push({ titleEn: { contains: term, mode: 'insensitive' } })
      }
      if (area === 'author' || area === 'all') {
        textOr.push({ authorsRaw: { contains: term, mode: 'insensitive' } })
      }
      if (area === 'keywords' || area === 'all') {
        textOr.push({ keywordsTr: { contains: term, mode: 'insensitive' } })
        textOr.push({ keywordsEn: { contains: term, mode: 'insensitive' } })
      }
    }
  }

  const publishedYearFilter =
    yearFrom || yearTo
      ? {
          ...(yearFrom ? { gte: yearFrom } : {}),
          ...(yearTo ? { lte: yearTo } : {}),
        }
      : undefined

  const where = {
    status: 'published' as const,
    ...(textOr.length ? { OR: textOr } : {}),
    ...(language ? { language } : {}),
    ...(journalId ? { journalId: BigInt(journalId) } : {}),
    ...(publishedYearFilter ? { publishedYear: publishedYearFilter } : {}),
  }

  const [rows, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      orderBy: { publishedYear: 'desc' },
      skip: offset,
      take: perPage,
      include: { journal: { select: { id: true, slug: true, titleTr: true } } },
    }),
    prisma.article.count({ where }),
  ])

  return {
    data: rows.map((row) => ({
      id: Number(row.id),
      slug: row.slug,
      legacy_journal_slug: row.legacyJournalSlug,
      title_tr: row.titleTr,
      title_en: row.titleEn,
      authors_raw: row.authorsRaw,
      keywords_tr: row.keywordsTr,
      published_year: row.publishedYear,
      journal_title: row.journal?.titleTr ?? null,
      journal_slug: row.journal?.slug ?? null,
      journal_id: row.journal ? Number(row.journal.id) : null,
    })),
    total,
  }
}

export async function searchJournalsPrisma(q: string, page: number, perPage: number) {
  const terms = expandSearchTerms(q)
  const offset = (page - 1) * perPage
  const textOr: Record<string, unknown>[] = []
  for (const term of terms) {
    textOr.push({ titleTr: { contains: term, mode: 'insensitive' as const } })
    textOr.push({ titleEn: { contains: term, mode: 'insensitive' as const } })
    textOr.push({ issn: { contains: term, mode: 'insensitive' as const } })
  }
  const where = {
    status: 'published' as const,
    ...(textOr.length ? { OR: textOr } : {}),
  }
  const [rows, total] = await prisma.$transaction([
    prisma.journal.findMany({
      where,
      orderBy: { titleTr: 'asc' },
      skip: offset,
      take: perPage,
      select: { id: true, slug: true, titleTr: true, titleEn: true, issn: true, publisher: true },
    }),
    prisma.journal.count({ where }),
  ])
  return {
    data: rows.map((r) => ({
      id: Number(r.id),
      slug: r.slug,
      title_tr: r.titleTr,
      title_en: r.titleEn,
      issn: r.issn,
      publisher: r.publisher,
    })) as JournalResult[],
    total,
  }
}

export async function searchAuthorsPrisma(q: string, page: number, perPage: number) {
  const terms = expandSearchTerms(q)
  const offset = (page - 1) * perPage
  const textOr = terms.map((term) => ({
    name: { contains: term, mode: 'insensitive' as const },
  }))
  const where = textOr.length ? { OR: textOr } : {}
  const [rows, total] = await prisma.$transaction([
    prisma.author.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: offset,
      take: perPage,
      select: { id: true, slug: true, name: true },
    }),
    prisma.author.count({ where }),
  ])
  return {
    data: rows.map((r) => ({
      id: Number(r.id),
      slug: r.slug,
      name: r.name,
    })) as AuthorResult[],
    total,
  }
}

export async function getPdfFileForArticle(articleId: number) {
  const row = await prisma.pdfFile.findUnique({
    where: { articleId: BigInt(articleId) },
  })
  return row ? mapPdfFile(row) : null
}
