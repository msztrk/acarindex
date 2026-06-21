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
    <section className="content-width py-8 md:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 lg:gap-10">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5">
            <h2 className="text-lg font-semibold text-foreground">Son eklenen makaleler</h2>
            <Link
              href="/search?type=article"
              className="text-sm font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-2 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Tüm makaleleri görüntüle →
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
  )
}
