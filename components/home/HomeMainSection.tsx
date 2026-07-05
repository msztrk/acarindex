import Link from 'next/link'

import { RecentArticlesList } from '@/components/home/RecentArticlesList'

import { FeaturedJournalsList } from '@/components/home/FeaturedJournalsList'

import { TopicAreasList } from '@/components/home/TopicAreasList'

import {

  loadFeaturedJournals,

  loadInterestAreaArticleSections,

  loadRecentArticles,

  loadTopicAreas,

  type HomeQaMode,

} from '@/lib/home/data'

import { getSessionInterestCategories } from '@/lib/personalization/interest-categories'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { getUiMessages } from '@/lib/i18n/ui-messages'
import { withLocalePath } from '@/lib/i18n/locale'

export async function HomeMainSection({ qa }: { qa?: HomeQaMode }) {
  const locale = await getRequestLocale()
  const ui = getUiMessages(locale)
  const lp = (path: string) => withLocalePath(path, locale)
  const interests = qa ? [] : await getSessionInterestCategories()



  const [recentArticles, featuredJournals, topicAreas, interestSections] = await Promise.all([

    loadRecentArticles(qa),

    loadFeaturedJournals(qa),

    loadTopicAreas(),

    loadInterestAreaArticleSections(interests),

  ])



  const showPersonalized = interestSections.length > 0



  return (

    <section className="content-width py-8 md:py-10 lg:py-12">

      <div className="layout-with-sidebar">

        <div className="min-w-0 space-y-10">

          {showPersonalized ? (

            interestSections.map((section) => (

              <div key={section.categoryId}>

                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-5">

                  <div>

                    <h2 className="text-xl font-semibold text-foreground tracking-tight">
                      {ui.home.personalizedTitle.replace('{category}', section.categoryLabel)}
                    </h2>
                    <p className="mt-1 text-base text-muted-foreground">
                      {ui.home.personalizedDesc}
                    </p>
                  </div>
                  <Link
                    href={lp(`/journals?category=${section.categoryId}`)}
                    className="text-[0.9375rem] font-semibold text-brand-secondary hover:text-brand-primary transition-colors shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
                  >
                    {ui.home.journalsInField}

                  </Link>

                </div>

                <RecentArticlesList articles={section.articles} locale={locale} />

              </div>

            ))

          ) : (

            <div>

              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-5">

                <div>

                  <h2 className="text-xl font-semibold text-foreground tracking-tight">
                    {ui.home.recentArticles}
                  </h2>
                  <p className="mt-1 text-base text-muted-foreground">
                    {ui.home.recentArticlesDesc}
                  </p>
                </div>
                <Link
                  href={lp('/search?type=article')}
                  className="text-[0.9375rem] font-semibold text-brand-secondary hover:text-brand-primary transition-colors shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
                >
                  {ui.home.viewAllArticles}

                </Link>

              </div>

              <RecentArticlesList articles={recentArticles} locale={locale} />

            </div>

          )}

        </div>



        <aside className="layout-sidebar-column min-w-0 space-y-0 lg:pt-0">

          <FeaturedJournalsList journals={featuredJournals} />

          <TopicAreasList categories={topicAreas} />

        </aside>

      </div>

    </section>

  )

}


