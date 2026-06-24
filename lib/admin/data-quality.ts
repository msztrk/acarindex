import { prisma } from '@/lib/db/prisma'
import { parsePagination, paginationMeta } from '@/lib/admin/pagination'

export type DataQualityCategory =
  | 'duplicate_slug'
  | 'orphan_article'
  | 'orphan_issue'
  | 'missing_pdf'
  | 'empty_authors_raw'
  | 'failed_etl'
  | 'open_author_claims'
  | 'url_alias_issues'

export async function loadDataQualitySummary() {
  const [
    duplicateSlug,
    orphanArticle,
    orphanIssue,
    missingPdf,
    emptyAuthorsRaw,
    failedEtl,
    openClaims,
    aliasIssues,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT slug FROM articles GROUP BY slug HAVING COUNT(*) > 1
      ) t
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM articles a
      WHERE a.issue_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = a.issue_id)
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM issues i
      WHERE NOT EXISTS (SELECT 1 FROM journals j WHERE j.id = i.journal_id)
    `,
    prisma.article.count({
      where: {
        OR: [{ pdfFile: null }, { pdfFile: { fileStatus: 'missing' } }],
      },
    }),
    prisma.article.count({
      where: { authorsRaw: null, status: 'published' },
    }),
    prisma.etlRun.count({ where: { status: { in: ['failed', 'aborted'] } } }),
    prisma.authorClaim.count({ where: { status: 'pending' } }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM url_aliases
      WHERE legacy_path = canonical_path
    `,
  ])

  return {
    duplicateSlug: duplicateSlug[0]?.count ?? 0,
    orphanArticle: orphanArticle[0]?.count ?? 0,
    orphanIssue: orphanIssue[0]?.count ?? 0,
    missingPdf,
    emptyAuthorsRaw,
    failedEtl,
    openAuthorClaims: openClaims,
    urlAliasIssues: aliasIssues[0]?.count ?? 0,
  }
}

export async function loadDataQualityPage(
  category: DataQualityCategory,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, pageSize, skip } = parsePagination(searchParams)

  switch (category) {
    case 'duplicate_slug': {
      const rows = await prisma.$queryRaw<
        Array<{ slug: string; count: number; ids: string }>
      >`
        SELECT slug, COUNT(*)::int AS count, string_agg(id::text, ',') AS ids
        FROM articles GROUP BY slug HAVING COUNT(*) > 1
        ORDER BY slug LIMIT ${pageSize} OFFSET ${skip}
      `
      const total = (await loadDataQualitySummary()).duplicateSlug
      return { rows, meta: paginationMeta(total, page, pageSize), category }
    }
    case 'orphan_article': {
      const [rows, totalRow] = await Promise.all([
        prisma.$queryRaw<Array<{ id: number; slug: string; issue_id: number }>>`
          SELECT a.id::int, a.slug, a.issue_id::int
          FROM articles a
          WHERE a.issue_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = a.issue_id)
          ORDER BY a.id LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM articles a
          WHERE a.issue_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = a.issue_id)
        `,
      ])
      const total = totalRow[0]?.count ?? 0
      return { rows, meta: paginationMeta(total, page, pageSize), category }
    }
    case 'orphan_issue': {
      const [rows, totalRow] = await Promise.all([
        prisma.$queryRaw<Array<{ id: number; journal_id: number }>>`
          SELECT i.id::int, i.journal_id::int FROM issues i
          WHERE NOT EXISTS (SELECT 1 FROM journals j WHERE j.id = i.journal_id)
          ORDER BY i.id LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM issues i
          WHERE NOT EXISTS (SELECT 1 FROM journals j WHERE j.id = i.journal_id)
        `,
      ])
      const total = totalRow[0]?.count ?? 0
      return { rows, meta: paginationMeta(total, page, pageSize), category }
    }
    case 'missing_pdf': {
      const where = {
        OR: [{ pdfFile: null }, { pdfFile: { fileStatus: 'missing' } }],
      }
      const [rows, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { id: 'asc' },
          skip,
          take: pageSize,
          select: { id: true, slug: true, legacyJournalSlug: true, titleTr: true },
        }),
        prisma.article.count({ where }),
      ])
      return {
        rows: rows.map((r) => ({ ...r, id: Number(r.id) })),
        meta: paginationMeta(total, page, pageSize),
        category,
      }
    }
    case 'empty_authors_raw': {
      const where = { authorsRaw: null, status: 'published' }
      const [rows, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { id: 'asc' },
          skip,
          take: pageSize,
          select: { id: true, slug: true, titleTr: true },
        }),
        prisma.article.count({ where }),
      ])
      return {
        rows: rows.map((r) => ({ ...r, id: Number(r.id) })),
        meta: paginationMeta(total, page, pageSize),
        category,
      }
    }
    case 'failed_etl': {
      const where = { status: { in: ['failed', 'aborted'] } }
      const [rows, total] = await Promise.all([
        prisma.etlRun.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.etlRun.count({ where }),
      ])
      return {
        rows: rows.map((r) => ({
          ...r,
          id: Number(r.id),
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
        })),
        meta: paginationMeta(total, page, pageSize),
        category,
      }
    }
    case 'open_author_claims': {
      const where = { status: 'pending' }
      const [rows, total] = await Promise.all([
        prisma.authorClaim.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.authorClaim.count({ where }),
      ])
      return { rows, meta: paginationMeta(total, page, pageSize), category }
    }
    case 'url_alias_issues': {
      const [rows, totalRow] = await Promise.all([
        prisma.$queryRaw<Array<{ legacy_path: string; canonical_path: string }>>`
          SELECT legacy_path, canonical_path FROM url_aliases
          WHERE legacy_path = canonical_path
          ORDER BY legacy_path LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM url_aliases WHERE legacy_path = canonical_path
        `,
      ])
      const total = totalRow[0]?.count ?? 0
      return { rows, meta: paginationMeta(total, page, pageSize), category }
    }
    default:
      return { rows: [], meta: paginationMeta(0, page, pageSize), category }
  }
}
