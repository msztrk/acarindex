import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HomeHero } from '@/components/home/HomeHero'
import { RecentArticlesList, type RecentArticleItem } from '@/components/home/RecentArticlesList'
import { FeaturedJournalsList, type FeaturedJournalItem } from '@/components/home/FeaturedJournalsList'
import { TopicAreasList, type TopicAreaItem } from '@/components/home/TopicAreasList'
import type { PlatformStats } from '@/types/database'

export const metadata: Metadata = {
  title: 'AcarIndex — Akademik İndeks Platformu',
  description:
    'Türkçe ve uluslararası akademik makalelere, dergilere ve yazarlara açık erişim sağlayan akademik arama ve indeks platformu.',
}

export const revalidate = 3600 // ISR: platform_stats reltuples + tam metin sayımı; saatlik yenileme yeterli

async function getStats(): Promise<PlatformStats | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('platform_stats')
      .select('journal_count, article_count, pdf_count')
      .single()
    return data
  } catch {
    return null
  }
}

async function getRecentArticles(): Promise<RecentArticleItem[]> {
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

/** Erişilebilir tam metin: file_status='missing' kayıtları hariç (platform_stats.pdf_count ile uyumlu). */
async function getAccessiblePdfCount(): Promise<number | null> {
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

async function getFeaturedJournals(): Promise<FeaturedJournalItem[]> {
  const sb = await createClient()
  // Sıralama: legacy hit_count (görüntülenme); gerçek makale sayısı değil.
  const { data } = await sb
    .from('journals')
    .select('id, slug, title_tr, issn, hit_count')
    .eq('status', 'published')
    .order('hit_count', { ascending: false })
    .limit(6)

  return (data ?? []) as FeaturedJournalItem[]
}

async function getTopicAreas(): Promise<TopicAreaItem[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('categories')
    .select('id, name_tr, name_en')
    .eq('active', true)
    .order('name_tr')

  return (data ?? []) as TopicAreaItem[]
}

export default async function HomePage() {
  const [stats, recentArticles, featuredJournals, topicAreas, accessiblePdfCount] = await Promise.all([
    getStats(),
    getRecentArticles(),
    getFeaturedJournals(),
    getTopicAreas(),
    getAccessiblePdfCount(),
  ])

  const pdfCount = accessiblePdfCount ?? stats?.pdf_count ?? null

  return (
    <div>
      <HomeHero
        journalCount={stats?.journal_count ?? null}
        articleCount={stats?.article_count ?? null}
        pdfCount={pdfCount}
        pdfCountExact={accessiblePdfCount !== null}
      />

      <section className="content-width py-10 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10 lg:gap-14">
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Son eklenen makaleler</h2>
              <Link
                href="/search?type=article"
                className="text-xs text-primary hover:underline shrink-0"
              >
                Tüm makaleler →
              </Link>
            </div>
            <RecentArticlesList articles={recentArticles} />
          </div>

          <aside className="lg:pt-0">
            <FeaturedJournalsList journals={featuredJournals} />
            <TopicAreasList categories={topicAreas} />
          </aside>
        </div>
      </section>
    </div>
  )
}
