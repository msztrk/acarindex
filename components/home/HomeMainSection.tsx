import Link from 'next/link'
import { RecentArticlesList } from '@/components/home/RecentArticlesList'
import { FeaturedJournalsList } from '@/components/home/FeaturedJournalsList'
import { TopicAreasList } from '@/components/home/TopicAreasList'
import {
  loadFeaturedJournals,
  loadRecentArticles,
  loadTopicAreas,
  type HomeQaMode,
} from '@/lib/home/data'

export async function HomeMainSection({ qa }: { qa?: HomeQaMode }) {
  const [recentArticles, featuredJournals, topicAreas] = await Promise.all([
    loadRecentArticles(qa),
    loadFeaturedJournals(qa),
    loadTopicAreas(),
  ])

  return (
    <section className="content-width py-8 md:py-10 lg:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Son eklenen makaleler
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kataloga yeni eklenen akademik yayınlar
              </p>
            </div>
            <Link
              href="/search?type=article"
              className="text-sm font-semibold text-brand-secondary hover:text-brand-primary transition-colors shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
            >
              Tüm makaleleri görüntüle →
            </Link>
          </div>
          <RecentArticlesList articles={recentArticles} />
        </div>

        <aside className="min-w-0 space-y-0 lg:pt-0">
          <FeaturedJournalsList journals={featuredJournals} />
          <TopicAreasList categories={topicAreas} />
        </aside>
      </div>
    </section>
  )
}
