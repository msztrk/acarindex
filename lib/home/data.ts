import * as platformData from '@/lib/data/platform'
import * as catalogData from '@/lib/data/catalog'
import type { PlatformStats } from '@/types/database'
import type { RecentArticleItem } from '@/components/home/RecentArticlesList'
import type { FeaturedJournalItem } from '@/components/home/FeaturedJournalsList'
import type { TopicAreaItem } from '@/components/home/TopicAreasList'

export type HomeQaMode =
  | 'empty-articles'
  | 'empty-journals'
  | 'stats-error'
  | 'loading'
  | undefined

export function resolveHomeQaMode(qa: string | undefined): HomeQaMode {
  if (process.env.NODE_ENV !== 'development' || !qa) return undefined
  if (
    qa === 'empty-articles' ||
    qa === 'empty-journals' ||
    qa === 'stats-error' ||
    qa === 'loading'
  ) {
    return qa
  }
  return undefined
}

export type HomeStatsBundle = {
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  pdfCountExact: boolean
  statsError: boolean
}

async function fetchStats(): Promise<{ stats: PlatformStats | null; error: boolean }> {
  try {
    const row = await platformData.getPlatformStats()
    if (!row) return { stats: null, error: true }
    return {
      stats: {
        journal_count: Number(row.journal_count),
        article_count: Number(row.article_count),
        pdf_count: Number(row.pdf_count),
        total_hits: Number(row.total_hits),
        author_count: Number(row.author_count),
        institution_count: Number(row.institution_count),
        refreshed_at: row.refreshed_at.toISOString(),
      },
      error: false,
    }
  } catch {
    return { stats: null, error: true }
  }
}

async function fetchAccessiblePdfCount(): Promise<number | null> {
  try {
    return await platformData.countAccessiblePdfs()
  } catch {
    return null
  }
}

export async function loadHomeStats(qa?: HomeQaMode): Promise<HomeStatsBundle> {
  if (qa === 'stats-error') {
    return {
      journalCount: null,
      articleCount: null,
      pdfCount: null,
      pdfCountExact: false,
      statsError: true,
    }
  }

  const [{ stats, error }, accessiblePdfCount] = await Promise.all([
    fetchStats(),
    fetchAccessiblePdfCount(),
  ])

  const pdfCount = accessiblePdfCount ?? stats?.pdf_count ?? null

  return {
    journalCount: stats?.journal_count ?? null,
    articleCount: stats?.article_count ?? null,
    pdfCount,
    pdfCountExact: accessiblePdfCount !== null,
    statsError: error,
  }
}

export async function loadRecentArticles(qa?: HomeQaMode): Promise<RecentArticleItem[]> {
  if (qa === 'empty-articles') return []
  return (await catalogData.listRecentArticles(8)) as RecentArticleItem[]
}

export async function loadFeaturedJournals(qa?: HomeQaMode): Promise<FeaturedJournalItem[]> {
  if (qa === 'empty-journals') return []
  return (await catalogData.listFeaturedJournals(6)) as FeaturedJournalItem[]
}

export async function loadTopicAreas(): Promise<TopicAreaItem[]> {
  return (await catalogData.listActiveCategories()) as TopicAreaItem[]
}
