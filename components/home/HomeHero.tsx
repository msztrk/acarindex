import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'

interface HomeStatsProps {
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
  journalCount,
  articleCount,
  pdfCount,
  pdfCountExact = false,
  statsError = false,
}: HomeStatsProps) {
  const approxNote = pdfCountExact ? 'dergi/makale yaklaşık' : 'yaklaşık sayılar'

  return (
    <section className="border-b border-border bg-background">
      <div className="content-width py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-14">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Akademik arama ve keşif
            </p>
            <h1 className="font-serif text-xl sm:text-2xl lg:text-[2rem] font-semibold text-foreground tracking-tight leading-[1.3] sm:leading-snug mb-5 lg:mb-6">
              Türkçe akademik makale, dergi ve yazarları tek yerden ara
            </h1>

            <SearchBar
              variant="hero"
              placeholder="Makale, yazar veya anahtar kelime…"
              className="w-full max-w-[820px]"
            />
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-[820px]">
              <span className="sm:hidden">Başlık, yazar ve anahtar kelime.</span>
              <span className="hidden sm:inline">
                Arama kapsamı: başlık, yazar ve anahtar kelime. Özet araması sonraki sürümde.
              </span>
            </p>

            {statsError ? (
              <p className="mt-5 text-sm text-muted-foreground" role="status">
                Platform istatistikleri geçici olarak yüklenemedi.
              </p>
            ) : (
              <div className="mt-5">
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground max-w-md md:max-w-none md:flex md:flex-wrap md:items-center md:gap-x-3 md:gap-y-1"
                  role="list"
                >
                  <Link
                    href="/journals"
                    className="hover:text-foreground transition-colors"
                    role="listitem"
                  >
                    <span className="tabular-nums font-medium text-foreground">{fmt(journalCount)}</span>{' '}
                    dergi
                  </Link>
                  <Link
                    href="/search?type=article"
                    className="hover:text-foreground transition-colors"
                    role="listitem"
                  >
                    <span className="tabular-nums font-medium text-foreground">{fmt(articleCount)}</span>{' '}
                    makale
                  </Link>
                  <span
                    className="col-span-2 flex justify-center md:col-span-1 md:justify-start"
                    role="listitem"
                  >
                    <span className="tabular-nums font-medium text-foreground">{fmt(pdfCount)}</span> tam
                    metin
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">({approxNote})</p>
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:pt-10">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Popüler aramalar
            </h2>
            <ul className="space-y-1.5">
              {POPULAR_SEARCHES.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors no-underline"
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
