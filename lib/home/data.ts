import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('platform_stats')
      .select('journal_count, article_count, pdf_count')
      .single()
    if (error) return { stats: null, error: true }
    return { stats: data as PlatformStats, error: false }
  } catch {
    return { stats: null, error: true }
  }
}

async function fetchAccessiblePdfCount(): Promise<number | null> {
  try {
    const sb = await createClient()
    const { count, error } = await sb
      .from('pdf_files')
      .select('id', { count: 'exact', head: true })
      .neq('file_status', 'missing')
    if (error) return null
    return count
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

  const sb = await createClient()
  const { data } = await sb
    .from('articles')
    .select(`
      id, slug, legacy_journal_slug, title_tr, title_en, authors_raw, published_year,
      journal:journals!journal_id ( id, slug, title_tr )
    `)
    .eq('status', 'published')
    .order('id', { ascending: false })
    .limit(8)

  return (data ?? []) as RecentArticleItem[]
}

export async function loadFeaturedJournals(qa?: HomeQaMode): Promise<FeaturedJournalItem[]> {
  if (qa === 'empty-journals') return []

  const sb = await createClient()
  const { data } = await sb
    .from('journals')
    .select('id, slug, title_tr, issn, hit_count')
    .eq('status', 'published')
    .order('hit_count', { ascending: false })
    .limit(6)

  return (data ?? []) as FeaturedJournalItem[]
}

export async function loadTopicAreas(): Promise<TopicAreaItem[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('categories')
    .select('id, name_tr, name_en')
    .eq('active', true)
    .order('name_tr')

  return (data ?? []) as TopicAreaItem[]
}
