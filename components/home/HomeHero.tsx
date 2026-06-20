import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'

interface HomeStatsProps {
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  /** Tam metin sayısı doğrudan pdf_files sayımından geldiğinde true (missing hariç). */
  pdfCountExact?: boolean
}

function fmt(n: number | null): string {
  if (!n) return '—'
  return n.toLocaleString('tr-TR')
}

export function HomeHero({ journalCount, articleCount, pdfCount, pdfCountExact = false }: HomeStatsProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="content-width py-10 md:py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Akademik arama ve keşif
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-snug mb-6">
            Türkçe akademik makale, dergi ve yazarları tek yerden ara
          </h1>

          <SearchBar
            variant="hero"
            placeholder="Başlık, yazar veya anahtar kelime…"
            className="max-w-xl"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Arama kapsamı: başlık, yazar ve anahtar kelime. Özet araması sonraki sürümde.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Link href="/journals" className="hover:text-foreground transition-colors">
              <span className="tabular-nums font-medium text-foreground">{fmt(journalCount)}</span> dergi
            </Link>
            <span className="text-border" aria-hidden>·</span>
            <Link href="/search?type=article" className="hover:text-foreground transition-colors">
              <span className="tabular-nums font-medium text-foreground">{fmt(articleCount)}</span> makale
            </Link>
            <span className="text-border" aria-hidden>·</span>
            <span>
              <span className="tabular-nums font-medium text-foreground">{fmt(pdfCount)}</span> tam metin
            </span>
            <span className="text-xs">
              ({pdfCountExact ? 'dergi/makale yaklaşık' : 'yaklaşık sayılar'})
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
