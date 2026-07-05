import { SearchBar } from '@/components/search/SearchBar'
import { SearchScopeLinks } from '@/components/home/SearchScopeLinks'
import { PopularSearchesCard } from '@/components/home/PopularSearchesCard'
import { HomeStatsCards } from '@/components/home/HomeStatsCards'
import type { UiMessages } from '@/lib/i18n/ui-messages'

interface HomeStatsProps {
  heroTitle: string
  heroSubtitle?: string | null
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  pdfCountExact?: boolean
  statsError?: boolean
  ui: UiMessages
}

export function HomeHero({
  heroTitle,
  heroSubtitle,
  journalCount,
  articleCount,
  pdfCount,
  pdfCountExact = false,
  statsError = false,
  ui,
}: HomeStatsProps) {
  const approxNote = pdfCountExact ? ui.home.approxNoteWithJournal : ui.home.approxNote

  return (
    <section className="relative border-b border-border/70 hero-surface overflow-hidden">
      <div className="content-width relative py-5 md:py-9 lg:py-10">
        <div className="layout-with-sidebar">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-brand-600 md:mb-3">
              {ui.home.eyebrow}
            </p>
            <h1
              className="mb-2 max-w-[40rem] text-balance font-serif text-2xl font-semibold leading-[1.24] tracking-tight text-foreground sm:text-[1.875rem] md:mb-3 lg:mb-4 lg:text-[2.125rem] lg:leading-[1.3] xl:max-w-[44rem]"
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="mb-3 max-w-[40rem] text-base leading-relaxed text-muted-foreground md:mb-5">
                {heroSubtitle}
              </p>
            )}

            <div className="max-w-[920px]">
              <SearchBar
                variant="hero"
                placeholder={ui.home.searchPlaceholder}
                className="w-full"
              />
              <div className="mt-2 space-y-1.5 md:mt-3 md:space-y-2">
                <SearchScopeLinks />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="sm:hidden">{ui.home.searchHintMobile}</span>
                  <span className="hidden sm:inline">{ui.home.searchHint}</span>
                </p>
              </div>
            </div>

            {statsError ? (
              <p className="mt-3 text-base text-muted-foreground md:mt-5" role="status">
                {ui.home.statsError}
              </p>
            ) : (
              <HomeStatsCards
                journalCount={journalCount}
                articleCount={articleCount}
                pdfCount={pdfCount}
                approxNote={approxNote}
              />
            )}

            <div className="mt-4 lg:hidden">
              <PopularSearchesCard />
            </div>
          </div>

          <aside className="layout-sidebar-column hidden lg:block lg:pt-2">
            <PopularSearchesCard />
          </aside>
        </div>
      </div>
    </section>
  )
}
