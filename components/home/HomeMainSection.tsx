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
  )
}
