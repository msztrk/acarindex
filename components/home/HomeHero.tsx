import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'

interface HomeStatsProps {
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  pdfCountExact?: boolean
  statsError?: boolean
}

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
      <div className="content-width py-10 md:py-12">
        <div className="max-w-3xl lg:max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Akademik arama ve keşif
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-[2rem] font-semibold text-foreground tracking-tight leading-snug mb-6">
            Türkçe akademik makale, dergi ve yazarları tek yerden ara
          </h1>

          <SearchBar
            variant="hero"
            placeholder="Başlık, yazar veya anahtar kelime…"
            className="w-full max-w-2xl"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Arama kapsamı: başlık, yazar ve anahtar kelime. Özet araması sonraki sürümde.
          </p>

          {statsError ? (
            <p className="mt-6 text-sm text-muted-foreground" role="status">
              Platform istatistikleri geçici olarak yüklenemedi.
            </p>
          ) : (
            <div className="mt-6">
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
                <span className="col-span-2 md:col-span-1" role="listitem">
                  <span className="tabular-nums font-medium text-foreground">{fmt(pdfCount)}</span> tam
                  metin
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">({approxNote})</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
