import * as platformData from '@/lib/data/platform'
import { prisma } from '@/lib/db/prisma'

export async function loadStatsPageData() {
  const stats = await platformData.getPlatformStats()
  const topJournals = await prisma.journal.findMany({
    where: { status: 'published' },
    orderBy: { hitCount: 'desc' },
    take: 10,
    select: { id: true, slug: true, titleTr: true, hitCount: true },
  })
  const recentArticles = await prisma.article.findMany({
    where: { status: 'published' },
    orderBy: { id: 'desc' },
    take: 10,
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
}
