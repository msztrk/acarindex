import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'

interface HomeStatsProps {
  heroTitle: string
  heroSubtitle?: string | null
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  pdfCountExact?: boolean
  statsError?: boolean
}

// Pilot/tasarım kapsamında sabit popüler aramalar. İleride Supabase
// categories/topics verisinden dinamikleştirilecek; bu aşamada yeni sorgu veya şema değişikliği yok.
const POPULAR_SEARCHES = [
  { label: 'Eğitim', href: '/search?q=eğitim&type=article' },
  { label: 'Türk Dili', href: '/search?q=türk+dili&type=article' },
  { label: 'İktisat', href: '/search?q=iktisat&type=article' },
  { label: 'Tıp', href: '/search?q=tıp&type=article' },
  { label: 'Mühendislik', href: '/search?q=mühendislik&type=article' },
  { label: 'Hukuk', href: '/search?q=hukuk&type=article' },
]

function fmt(n: number | null): string {
  if (!n) return '—'
  return n.toLocaleString('tr-TR')
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
    <section className="border-b border-border bg-background">
      <div className="content-width py-7 md:py-9">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 lg:gap-10">
          <div className="min-w-0 lg:max-w-[52rem]">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
              Akademik arama ve keşif
            </p>
            <h1
              className="font-serif text-xl sm:text-2xl lg:text-[1.875rem] font-semibold text-foreground tracking-tight text-balance leading-[1.35] sm:leading-[1.32] mb-3 lg:mb-4 max-w-[40rem] xl:max-w-[44rem]"
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4 max-w-[40rem]">
                {heroSubtitle}
              </p>
            )}

            <SearchBar
              variant="hero"
              placeholder="Makale, yazar veya anahtar kelime…"
              className="w-full max-w-[840px]"
            />
            <p className="mt-2 text-[0.8125rem] text-muted-foreground leading-relaxed max-w-[840px]">
              <span className="sm:hidden">Başlık, yazar ve anahtar kelime.</span>
              <span className="hidden sm:inline">
                Arama kapsamı: başlık, yazar ve anahtar kelime. Özet araması sonraki sürümde.
              </span>
            </p>

            {statsError ? (
              <p className="mt-4 text-sm text-muted-foreground" role="status">
                Platform istatistikleri geçici olarak yüklenemedi.
              </p>
            ) : (
              <div className="mt-4 md:mt-5">
                <div
                  className="flex flex-wrap items-baseline justify-center md:justify-start gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground"
                  role="list"
                >
                  <Link
                    href="/journals"
                    className="inline-flex items-baseline gap-1.5 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    role="listitem"
                  >
                    <span className="tabular-nums text-base font-semibold text-foreground">
                      {fmt(journalCount)}
                    </span>
                    <span>dergi</span>
                  </Link>
                  <Link
                    href="/search?type=article"
                    className="inline-flex items-baseline gap-1.5 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    role="listitem"
                  >
                    <span className="tabular-nums text-base font-semibold text-foreground">
                      {fmt(articleCount)}
                    </span>
                    <span>makale</span>
                  </Link>
                  <span
                    className="inline-flex items-baseline gap-1.5 justify-center md:justify-start"
                    role="listitem"
                  >
                    <span className="tabular-nums text-base font-semibold text-foreground">
                      {fmt(pdfCount)}
                    </span>
                    <span>tam metin</span>
                  </span>
                </div>
                <p className="text-[0.6875rem] text-muted-foreground mt-1.5 text-center md:text-left">
                  ({approxNote})
                </p>
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:pt-7">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-3">
              Popüler aramalar
            </h2>
            <ul className="space-y-2">
              {POPULAR_SEARCHES.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-[0.9375rem] text-foreground/85 hover:text-primary hover:underline underline-offset-2 transition-colors no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  )
}
