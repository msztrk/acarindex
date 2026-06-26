import { SearchBar } from '@/components/search/SearchBar'
import { SearchScopeLinks } from '@/components/home/SearchScopeLinks'
import { PopularSearchesCard } from '@/components/home/PopularSearchesCard'
import { HomeStatsCards } from '@/components/home/HomeStatsCards'

interface HomeStatsProps {
  heroTitle: string
  heroSubtitle?: string | null
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  pdfCountExact?: boolean
  statsError?: boolean
}

export function HomeHero({
  heroTitle,
  heroSubtitle,
  journalCount,
  articleCount,
  pdfCount,
  pdfCountExact = false,
  statsError = false,
}: HomeStatsProps) {
  const approxNote = pdfCountExact ? 'dergi/makale yaklaşık' : 'yaklaşık sayılar'

  return (
    <section className="relative border-b border-border/70 hero-surface overflow-hidden">
      <div className="content-width relative py-5 md:py-9 lg:py-10">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 lg:max-w-[52rem]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 md:mb-3">
              Akademik arama ve keşif
            </p>
            <h1
              className="mb-2 max-w-[40rem] text-balance font-serif text-2xl font-semibold leading-[1.24] tracking-tight text-foreground sm:text-[1.75rem] md:mb-3 lg:mb-4 lg:text-[2rem] lg:leading-[1.3] xl:max-w-[44rem]"
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="mb-3 max-w-[40rem] text-sm leading-relaxed text-muted-foreground sm:text-base md:mb-5">
                {heroSubtitle}
              </p>
            )}

            <div className="max-w-[840px]">
              <SearchBar
                variant="hero"
                placeholder="Makale, yazar veya anahtar kelime…"
                className="w-full"
              />
              <div className="mt-2 space-y-1.5 md:mt-3 md:space-y-2">
                <SearchScopeLinks />
                <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                  <span className="sm:hidden">Başlık, yazar ve anahtar kelime.</span>
                  <span className="hidden sm:inline">
                    Arama kapsamı: başlık, yazar ve anahtar kelime. Özet araması sonraki sürümde.
                  </span>
                </p>
              </div>
            </div>

            {statsError ? (
              <p className="mt-3 text-sm text-muted-foreground md:mt-5" role="status">
                Platform istatistikleri geçici olarak yüklenemedi.
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

          <aside className="hidden lg:block lg:pt-2">
            <PopularSearchesCard />
          </aside>
        </div>
      </div>
    </section>
  )
}
