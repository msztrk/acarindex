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
  boostCategoryIds?: number[]
  personalize?: boolean
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
  category_label: string | null
  matches_interest: boolean
}

export interface JournalResult {
  id: number
  slug: string
  title_tr: string | null
  title_en: string | null
  issn: string | null
  publisher: string | null
  category_label: string | null
  matches_interest: boolean
}

export interface AuthorResult {
  id: number
  slug: string | null
  name: string
}

export async function searchArticlesPrisma(
  params: PrismaSearchParams,
): Promise<{ data: ArticleResult[]; total: number; interestTotal: number }> {
  const {
    q,
    area,
    language,
    journalId,
    yearFrom,
    yearTo,
    page,
    perPage,
    boostCategoryIds = [],
    personalize = true,
  } = params
  const terms = expandSearchTerms(q)
  const offset = (page - 1) * perPage
  const boostIds =
    personalize && boostCategoryIds.length > 0
      ? boostCategoryIds.map((id) => BigInt(id))
      : []

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

  const baseWhere = {
    status: 'published' as const,
    ...(textOr.length ? { OR: textOr } : {}),
    ...(language ? { language } : {}),
    ...(journalId ? { journalId: BigInt(journalId) } : {}),
    ...(publishedYearFilter ? { publishedYear: publishedYearFilter } : {}),
  }

  const journalInclude = {
    journal: {
      select: {
        id: true,
        slug: true,
        titleTr: true,
        categoryId: true,
        category: { select: { nameTr: true } },
      },
    },
  } as const

  const mapRow = (row: {
    id: bigint
    slug: string
    legacyJournalSlug: string
    titleTr: string | null
    titleEn: string | null
    authorsRaw: string | null
    keywordsTr: string | null
    publishedYear: number | null
    journal: {
      id: bigint
      slug: string
      titleTr: string | null
      categoryId: bigint | null
      category: { nameTr: string | null } | null
    } | null
  }): ArticleResult => {
    const categoryId = row.journal?.categoryId ?? null
    const matchesInterest =
      boostIds.length > 0 && categoryId != null && boostIds.includes(categoryId)
    return {
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
      category_label: row.journal?.category?.nameTr ?? null,
      matches_interest: matchesInterest,
    }
  }

  if (boostIds.length === 0) {
    const where = baseWhere
    const [rows, total] = await prisma.$transaction([
      prisma.article.findMany({
        where,
        orderBy: [{ publishedYear: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: perPage,
        include: journalInclude,
      }),
      prisma.article.count({ where }),
    ])
    return { data: rows.map(mapRow), total, interestTotal: 0 }
  }

  const boostedWhere = {
    ...baseWhere,
    journal: { categoryId: { in: boostIds } },
  }
  const otherWhere = {
    AND: [
      baseWhere,
      {
        OR: [
          { journal: { categoryId: null } },
          { journal: { categoryId: { notIn: boostIds } } },
        ],
      },
    ],
  }

  const [boostedTotal, otherTotal] = await prisma.$transaction([
    prisma.article.count({ where: boostedWhere }),
    prisma.article.count({ where: otherWhere }),
  ])
  const total = boostedTotal + otherTotal

  type ArticleSearchRow = Parameters<typeof mapRow>[0]
  let rows: ArticleSearchRow[] = []

  if (offset < boostedTotal) {
    const boostedRows = await prisma.article.findMany({
      where: boostedWhere,
      orderBy: [{ publishedYear: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: perPage,
      include: journalInclude,
    })
    rows = boostedRows
    const remaining = perPage - boostedRows.length
    if (remaining > 0) {
      const otherRows = await prisma.article.findMany({
        where: otherWhere,
        orderBy: [{ publishedYear: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: remaining,
        include: journalInclude,
      })
      rows = [...boostedRows, ...otherRows]
    }
  } else {
    rows = await prisma.article.findMany({
      where: otherWhere,
      orderBy: [{ publishedYear: 'desc' }, { id: 'desc' }],
      skip: offset - boostedTotal,
      take: perPage,
      include: journalInclude,
    })
  }

  return {
    data: rows.map(mapRow),
    total,
    interestTotal: boostedTotal,
  }
}

export async function searchJournalsPrisma(
  q: string,
  page: number,
  perPage: number,
  options?: { boostCategoryIds?: number[]; personalize?: boolean },
) {
  const terms = expandSearchTerms(q)
  const offset = (page - 1) * perPage
  const boostIds =
    options?.personalize !== false && options?.boostCategoryIds?.length
      ? options.boostCategoryIds.map((id) => BigInt(id))
      : []

  const textOr: Record<string, unknown>[] = []
  for (const term of terms) {
    textOr.push({ titleTr: { contains: term, mode: 'insensitive' as const } })
    textOr.push({ titleEn: { contains: term, mode: 'insensitive' as const } })
    textOr.push({ issn: { contains: term, mode: 'insensitive' as const } })
  }
  const baseWhere = {
    status: 'published' as const,
    ...(textOr.length ? { OR: textOr } : {}),
  }

  const journalSelect = {
    id: true,
    slug: true,
    titleTr: true,
    titleEn: true,
    issn: true,
    publisher: true,
    categoryId: true,
    category: { select: { nameTr: true } },
  } as const

  const mapRow = (row: {
    id: bigint
    slug: string
    titleTr: string | null
    titleEn: string | null
    issn: string | null
    publisher: string | null
    categoryId: bigint | null
    category: { nameTr: string | null } | null
  }): JournalResult => ({
    id: Number(row.id),
    slug: row.slug,
    title_tr: row.titleTr,
    title_en: row.titleEn,
    issn: row.issn,
    publisher: row.publisher,
    category_label: row.category?.nameTr ?? null,
    matches_interest:
      boostIds.length > 0 && row.categoryId != null && boostIds.includes(row.categoryId),
  })

  if (boostIds.length === 0) {
    const [rows, total] = await prisma.$transaction([
      prisma.journal.findMany({
        where: baseWhere,
        orderBy: { titleTr: 'asc' },
        skip: offset,
        take: perPage,
        select: journalSelect,
      }),
      prisma.journal.count({ where: baseWhere }),
    ])
    return { data: rows.map(mapRow), total, interestTotal: 0 }
  }

  const boostedWhere = { ...baseWhere, categoryId: { in: boostIds } }
  const otherWhere = {
    AND: [
      baseWhere,
      {
        OR: [{ categoryId: null }, { categoryId: { notIn: boostIds } }],
      },
    ],
  }

  const [boostedTotal, otherTotal] = await prisma.$transaction([
    prisma.journal.count({ where: boostedWhere }),
    prisma.journal.count({ where: otherWhere }),
  ])
  const total = boostedTotal + otherTotal

  let rows: Array<{
    id: bigint
    slug: string
    titleTr: string | null
    titleEn: string | null
    issn: string | null
    publisher: string | null
    categoryId: bigint | null
    category: { nameTr: string | null } | null
  }> = []

  if (offset < boostedTotal) {
    const boostedRows = await prisma.journal.findMany({
      where: boostedWhere,
      orderBy: { titleTr: 'asc' },
      skip: offset,
      take: perPage,
      select: journalSelect,
    })
    rows = boostedRows
    const remaining = perPage - boostedRows.length
    if (remaining > 0) {
      const otherRows = await prisma.journal.findMany({
        where: otherWhere,
        orderBy: { titleTr: 'asc' },
        skip: 0,
        take: remaining,
        select: journalSelect,
      })
      rows = [...boostedRows, ...otherRows]
    }
  } else {
    rows = await prisma.journal.findMany({
      where: otherWhere,
      orderBy: { titleTr: 'asc' },
      skip: offset - boostedTotal,
      take: perPage,
      select: journalSelect,
    })
  }

  return { data: rows.map(mapRow), total, interestTotal: boostedTotal }
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
