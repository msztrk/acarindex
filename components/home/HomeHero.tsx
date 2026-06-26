import Link from 'next/link'
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
    <section className="relative border-b border-border/80 hero-surface overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-primary/8 via-transparent to-brand-accent/6"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-brand-secondary/10 blur-3xl"
        aria-hidden
      />
      <div className="content-width relative py-8 md:py-10 lg:py-11">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-10">
          <div className="min-w-0 lg:max-w-[52rem]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-secondary mb-3">
              Akademik arama ve keşif
            </p>
            <h1
              className="font-serif text-2xl sm:text-[1.75rem] lg:text-[2rem] font-semibold text-foreground tracking-tight text-balance leading-[1.3] mb-3 lg:mb-4 max-w-[40rem] xl:max-w-[44rem]"
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 max-w-[40rem]">
                {heroSubtitle}
              </p>
            )}

            <div className="max-w-[840px]">
              <SearchBar
                variant="hero"
                placeholder="Makale, yazar veya anahtar kelime…"
                className="w-full"
              />
              <div className="mt-3 space-y-2">
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
              <p className="mt-5 text-sm text-muted-foreground" role="status">
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

            <div className="mt-6 lg:hidden">
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
