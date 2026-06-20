import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, BookOpen, User, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn, buttonVariants } from '@/lib/utils'
import {
  searchArticles, searchJournals, searchAuthors,
  parsePrefixQuery, type SearchType, type SearchArea,
} from '@/lib/search/search'

export const metadata: Metadata = {
  title: 'Arama — AcarIndex',
  robots: { index: false, follow: true },
}

interface PageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    area?: string
    language?: string
    year_from?: string
    year_to?: string
    page?: string
  }>
}

const PER_PAGE = 20

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const rawQ = (sp.q ?? '').trim()
  const type = (sp.type ?? 'article') as SearchType
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))

  // Legacy prefix ayrıştırma: "author:xxx"
  const { q, area: parsedArea } = parsePrefixQuery(rawQ)
  const areaRaw = sp.area ?? parsedArea
  const area = (['all', 'title', 'author', 'keywords'] as const).includes(areaRaw as SearchArea)
    ? (areaRaw as SearchArea)
    : 'all'

  const language = sp.language === 'en' ? 'en' : sp.language === 'tr' ? 'tr' : undefined
  const yearFrom = sp.year_from ? parseInt(sp.year_from, 10) : undefined
  const yearTo = sp.year_to ? parseInt(sp.year_to, 10) : undefined

  // Arama çalıştır
  let articleResults = { data: [] as Awaited<ReturnType<typeof searchArticles>>['data'], total: 0 }
  let journalResults = { data: [] as Awaited<ReturnType<typeof searchJournals>>['data'], total: 0 }
  let authorResults = { data: [] as Awaited<ReturnType<typeof searchAuthors>>['data'], total: 0 }

  if (q && type === 'article') {
    articleResults = await searchArticles({ q, type, area, language, yearFrom, yearTo, page, perPage: PER_PAGE })
  } else if (q && type === 'journal') {
    journalResults = await searchJournals(q, page, PER_PAGE)
  } else if (q && type === 'author') {
    authorResults = await searchAuthors(q, page, PER_PAGE)
  }

  const total = articleResults.total || journalResults.total || authorResults.total
  const totalPages = Math.ceil(total / PER_PAGE)
  const hasResults = total > 0

  // Query string builder (filtre değişince sayfa 1'e dön)
  function qs(overrides: Record<string, string | undefined>) {
    const base: Record<string, string> = {}
    if (rawQ) base.q = rawQ
    if (type !== 'article') base.type = type
    if (area !== 'all') base.area = area
    if (language) base.language = language
    if (sp.year_from) base.year_from = sp.year_from
    if (sp.year_to) base.year_to = sp.year_to
    const merged = { ...base, ...overrides }
    return '/search?' + new URLSearchParams(
      Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as Record<string, string>
    ).toString()
  }

  return (
    <div className="content-width py-8">
      {/* Arama formu */}
      <form method="GET" className="mb-8">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center border border-border rounded-xl overflow-hidden bg-background focus-within:ring-2 focus-within:ring-ring">
            <Search className="ml-4 h-5 w-5 text-muted-foreground shrink-0" />
            <input
              name="q"
              defaultValue={rawQ}
              type="search"
              placeholder="Makale, yazar, dergi veya konu ara…"
              className="flex-1 px-3 py-3 text-base bg-transparent outline-none"
              autoFocus={!rawQ}
            />
          </div>
          <button type="submit" className={cn(buttonVariants(), 'shrink-0 px-6')}>
            Ara
          </button>
        </div>

        {/* Tip seçimi */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(['article', 'journal', 'author'] as SearchType[]).map((t) => (
            <Link
              key={t}
              href={qs({ type: t, page: '1' })}
              className={cn(
                'text-sm px-3 py-1 rounded-full border transition-colors',
                type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
              )}
            >
              {t === 'article' ? 'Makaleler' : t === 'journal' ? 'Dergiler' : 'Yazarlar'}
            </Link>
          ))}
        </div>

        {/* Makale filtreleri */}
        {type === 'article' && (
          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            <select
              name="area"
              defaultValue={area}
              className="border border-border rounded-lg px-2 py-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Başlık, yazar, anahtar kelime</option>
              <option value="title">Yalnızca başlık</option>
              <option value="author">Yalnızca yazar</option>
              <option value="keywords">Yalnızca anahtar kelime</option>
            </select>
            <select
              name="language"
              defaultValue={language ?? ''}
              className="border border-border rounded-lg px-2 py-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tüm diller</option>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
            <input
              name="year_from"
              type="number"
              defaultValue={sp.year_from}
              placeholder="Yıldan"
              min="1900"
              max="2030"
              className="border border-border rounded-lg px-2 py-1 text-sm w-24 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="self-center text-muted-foreground">–</span>
            <input
              name="year_to"
              type="number"
              defaultValue={sp.year_to}
              placeholder="Yıla"
              min="1900"
              max="2030"
              className="border border-border rounded-lg px-2 py-1 text-sm w-24 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {/* type gizli input (select onClick yerine) */}
            <input type="hidden" name="type" value={type} />
          </div>
        )}
      </form>

      {/* Sonuçlar */}
      {!q ? (
        <EmptySearch />
      ) : !hasResults ? (
        <NoResults q={q} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{q}</span> için{' '}
              <span className="font-medium text-foreground">{total.toLocaleString('tr-TR')}</span> sonuç
            </p>
          </div>

          {/* Makale sonuçları */}
          {type === 'article' && (
            <div className="space-y-3">
              {articleResults.data.map((a) => (
                <ArticleCard key={a.id} article={a} q={q} />
              ))}
            </div>
          )}

          {/* Dergi sonuçları */}
          {type === 'journal' && (
            <div className="space-y-3">
              {journalResults.data.map((j) => (
                <div key={j.id} className="p-4 rounded-xl border border-border hover:border-accent/40 transition-colors">
                  <Link href={`/journals/${j.slug}-${j.id}`} className="font-medium text-primary hover:text-accent">
                    {j.title_tr ?? j.title_en}
                  </Link>
                  <div className="flex gap-2 mt-1">
                    {j.issn && <Badge variant="outline" className="text-xs">ISSN: {j.issn}</Badge>}
                    {j.publisher && <span className="text-xs text-muted-foreground">{j.publisher}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Yazar sonuçları */}
          {type === 'author' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {authorResults.data.map((a) => (
                <Link
                  key={a.id}
                  href={`/authors/${a.slug ?? a.id}-${a.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/40 transition-colors no-underline"
                >
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{a.name}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Sayfalama */}
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} qs={qs} />
          )}
        </>
      )}
    </div>
  )
}

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function ArticleCard({
  article,
  q,
}: {
  article: Awaited<ReturnType<typeof searchArticles>>['data'][number]
  q: string
}) {
  const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
  const href = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`

  const authors = article.authors_raw
    ?.split(',')
    .slice(0, 4)
    .map((a) => a.trim())
    .join('; ') ?? ''

  const keywords = article.keywords_tr
    ?.replace(/anahtar kelimeler[:;]?/i, '')
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5) ?? []

  return (
    <div className="p-4 rounded-xl border border-border hover:border-accent/40 hover:bg-secondary/30 transition-all">
      <Link href={href} className="font-serif text-base font-semibold text-primary hover:text-accent leading-snug block mb-1">
        {title}
      </Link>
      {authors && (
        <p className="text-sm text-muted-foreground mb-1">{authors}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
        {article.journal_title && (
          <Link href={`/journals/${article.journal_slug}-${article.journal_id}`} className="hover:text-foreground truncate max-w-[200px]">
            <BookOpen className="inline h-3 w-3 mr-0.5" />
            {article.journal_title}
          </Link>
        )}
        {article.published_year && <span>{article.published_year}</span>}
        <Link href={`/pdfs/${article.id}`} className="text-accent hover:underline flex items-center gap-0.5">
          <FileText className="h-3 w-3" /> PDF
        </Link>
      </div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywords.map((kw, i) => (
            <Link key={i} href={`/search?q=${encodeURIComponent(kw)}&area=keywords`} className="no-underline">
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-secondary">
                {kw}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({
  page, totalPages, qs,
}: {
  page: number
  totalPages: number
  qs: (o: Record<string, string | undefined>) => string
}) {
  const pages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
    if (totalPages <= 7) return i + 1
    if (page <= 4) return i + 1
    if (page >= totalPages - 3) return totalPages - 6 + i
    return page - 3 + i
  })

  return (
    <nav className="flex items-center justify-center gap-1 mt-8" aria-label="Sayfalama">
      {page > 1 && (
        <Link href={qs({ page: String(page - 1) })} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          ←
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={qs({ page: String(p) })}
          className={cn(
            buttonVariants({ variant: p === page ? 'default' : 'outline', size: 'sm' }),
            'min-w-[36px] justify-center',
          )}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={qs({ page: String(page + 1) })} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          →
        </Link>
      )}
    </nav>
  )
}

function EmptySearch() {
  return (
    <div className="py-16 text-center">
      <Search className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-medium mb-2">Aramak istediğinizi yazın</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Makale başlığı, yazar adı, ISSN veya anahtar kelime ile arama yapabilirsiniz.
        <br />
        Gelişmiş: <code className="bg-secondary px-1 rounded text-xs">author:Smith</code>{' '}
        <code className="bg-secondary px-1 rounded text-xs">title:makale</code>
      </p>
    </div>
  )
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-medium mb-2">
        &ldquo;{q}&rdquo; için sonuç bulunamadı
      </p>
      <p className="text-muted-foreground text-sm">Farklı anahtar kelimeler veya filtreler deneyin.</p>
    </div>
  )
}
