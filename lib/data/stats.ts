import * as platformData from '@/lib/data/platform'
import { prisma } from '@/lib/db/prisma'
import { STATS_RECENT_ARTICLES, STATS_TOP_JOURNALS } from '@/lib/data/constants'
import { runCatalogQuery } from '@/lib/data/query'

export async function loadStatsPageData() {
  return runCatalogQuery(async () => {
    const stats = await platformData.getPlatformStats()
    const topJournals = await prisma.journal.findMany({
      where: { status: 'published' },
      orderBy: { hitCount: 'desc' },
      take: STATS_TOP_JOURNALS,
      select: { id: true, slug: true, titleTr: true, hitCount: true },
    })
    const recentArticles = await prisma.article.findMany({
      where: { status: 'published' },
      orderBy: { id: 'desc' },
      take: STATS_RECENT_ARTICLES,
      select: { id: true, slug: true, legacyJournalSlug: true, titleTr: true, publishedYear: true },
    })
    const authorCount = await platformData.countAuthors()

    return {
      stats: stats
        ? {
            journal_count: Number(stats.journal_count),
            article_count: Number(stats.article_count),
            pdf_count: Number(stats.pdf_count),
            author_count: Number(stats.author_count),
            institution_count: Number(stats.institution_count),
          }
        : null,
      topJournals: topJournals.map((j) => ({
        id: Number(j.id),
        slug: j.slug,
        title_tr: j.titleTr,
        hit_count: j.hitCount,
      })),
      recentArticles: recentArticles.map((a) => ({
        id: Number(a.id),
        slug: a.slug,
        legacy_journal_slug: a.legacyJournalSlug,
        title_tr: a.titleTr,
        published_year: a.publishedYear,
      })),
      authorCount,
    }
  })
}

export async function getArticlesByYearGrouped(limit = 20) {
  const rows = await prisma.$queryRaw<Array<{ year: number; count: number }>>`
    SELECT published_year AS year, COUNT(*)::int AS count
    FROM articles
    WHERE status = 'published' AND published_year IS NOT NULL
    GROUP BY published_year
    ORDER BY published_year ASC
  `
  return rows.slice(-limit)
}