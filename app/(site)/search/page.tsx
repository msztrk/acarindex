import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, buttonVariants } from '@/lib/utils'
import { SitePageHeader } from '@/components/layout/SitePageHeader'
import { CatalogPdfLink } from '@/components/catalog/CatalogPdfLink'
import {
  parsePrefixQuery, type SearchType, type SearchArea,
  searchArticles, searchJournals, searchAuthors,
} from '@/lib/search/search'
import { loadSearchPageData } from '@/lib/data/page-loaders'
import { SEARCH_PER_PAGE } from '@/lib/data/constants'
import { CatalogErrorAlert } from '@/components/catalog/CatalogErrorAlert'
import { catalogErrorMessage } from '@/lib/data/query'
import {
  getSessionInterestCategories,
  interestCategoryIds,
} from '@/lib/personalization/interest-categories'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import type { SiteLocale } from '@/lib/i18n/locale'
import { pickLocalizedArticleDisplayTitle } from '@/lib/i18n/pick-localized-text'
import { pickLocalizedTitle } from '@/lib/seo/hreflang'

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
    personalize?: string
  }>
}

const PER_PAGE = SEARCH_PER_PAGE

function formatAuthors(raw: string | null, max = 4): string {
  if (!raw) return ''
  return raw
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(', ')
}

export default async function SearchPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale()
  const sp = await searchParams
  const rawQ = (sp.q ?? '').trim()
  const type = (sp.type ?? 'article') as SearchType
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))

  const { q, area: parsedArea } = parsePrefixQuery(rawQ)
  const areaRaw = sp.area ?? parsedArea
  const area = (['all', 'title', 'author', 'keywords'] as const).includes(areaRaw as SearchArea)
    ? (areaRaw as SearchArea)
    : 'all'

  const language = sp.language === 'en' ? 'en' : sp.language === 'tr' ? 'tr' : undefined
  const yearFrom = sp.year_from ? parseInt(sp.year_from, 10) : undefined
  const yearTo = sp.year_to ? parseInt(sp.year_to, 10) : undefined
  const personalize = sp.personalize !== '0'

  const interestCategories = personalize ? await getSessionInterestCategories() : []
  const boostCategoryIds = interestCategoryIds(interestCategories)

  let articleResults: Awaited<ReturnType<typeof searchArticles>> & { interestTotal?: number } = {
    data: [],
    total: 0,
    interestTotal: 0,
  }
  let journalResults: Awaited<ReturnType<typeof searchJournals>> & { interestTotal?: number } = {
    data: [],
    total: 0,
    interestTotal: 0,
  }
  let authorResults: Awaited<ReturnType<typeof searchAuthors>> = { data: [], total: 0 }
  let searchError: string | null = null
  let searchPersonalized = false

  if (q) {
    const result = await loadSearchPageData({
      q,
      type,
      area,
      language,
      yearFrom,
      yearTo,
      page,
      boostCategoryIds,
      personalize,
    })
    if (result.status === 'error') {
      searchError = catalogErrorMessage(result)
    } else if (result.status === 'ok') {
      articleResults = result.data.articleResults
      journalResults = result.data.journalResults
      authorResults = result.data.authorResults
      searchPersonalized = result.data.personalized
    }
  }

  const total = articleResults.total || journalResults.total || authorResults.total
  const totalPages = Math.ceil(total / PER_PAGE)
  const hasResults = total > 0

  function qs(overrides: Record<string, string | undefined>) {
    const base: Record<string, string> = {}
    if (rawQ) base.q = rawQ
    if (type !== 'article') base.type = type
    if (area !== 'all') base.area = area
    if (language) base.language = language
    if (sp.year_from) base.year_from = sp.year_from
    if (sp.year_to) base.year_to = sp.year_to
    if (sp.personalize === '0') base.personalize = '0'
    const merged = { ...base, ...overrides }
    return '/search?' + new URLSearchParams(
      Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as Record<string, string>
    ).toString()
  }

  const typeLabel = type === 'article' ? 'Makaleler' : type === 'journal' ? 'Dergiler' : 'Yazarlar'
  const interestArticleItems = articleResults.data.filter((a) => a.matches_interest)
  const otherArticleItems = articleResults.data.filter((a) => !a.matches_interest)
  const interestJournalItems = journalResults.data.filter((j) => j.matches_interest)
  const otherJournalItems = journalResults.data.filter((j) => !j.matches_interest)

  return (
    <div className="content-width py-6 md:py-8 min-w-0">
      <SitePageHeader title="Arama" className="mb-5 md:mb-6" />

        <form method="GET" className="space-y-3 mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0">
            <div
              className={cn(
                'flex-1 min-w-0 flex items-center border border-border rounded-xl overflow-hidden bg-background',
                'focus-within:ring-2 focus-within:ring-ring focus-within:border-ring',
              )}
            >
              <Search className="ml-3 sm:ml-4 h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
              <input
                name="q"
                defaultValue={rawQ}
                type="search"
                aria-label="Arama sorgusu"
                placeholder="Makale, yazar, dergi veya konu ara…"
                className="flex-1 min-w-0 px-3 py-3 sm:py-3.5 text-base bg-transparent outline-none placeholder:text-muted-foreground"
                autoFocus={!rawQ}
              />
            </div>
            <button
              type="submit"
              className={cn(
                buttonVariants(),
                'shrink-0 px-5 sm:px-6 min-h-[44px] font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              aria-label="Arama yap"
            >
              Ara
            </button>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Sonuç türü">
            {(['article', 'journal', 'author'] as SearchType[]).map((t) => (
              <Link
                key={t}
                href={qs({ type: t, page: '1' })}
                className={cn(
                  'text-sm px-3 py-1.5 min-h-[36px] inline-flex items-center rounded-full border transition-colors no-underline',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  type === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                )}
                aria-current={type === t ? 'true' : undefined}
              >
                {t === 'article' ? 'Makaleler' : t === 'journal' ? 'Dergiler' : 'Yazarlar'}
              </Link>
            ))}
          </div>

          {type === 'article' && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm min-w-0">
              <label className="sr-only" htmlFor="search-area">Arama alanı</label>
              <select
                id="search-area"
                name="area"
                defaultValue={area}
                className="border border-border rounded-lg px-2.5 py-2 text-sm bg-background text-foreground min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Başlık, yazar, anahtar kelime</option>
                <option value="title">Yalnızca başlık</option>
                <option value="author">Yalnızca yazar</option>
                <option value="keywords">Yalnızca anahtar kelime</option>
              </select>
              <label className="sr-only" htmlFor="search-language">Dil</label>
              <select
                id="search-language"
                name="language"
                defaultValue={language ?? ''}
                className="border border-border rounded-lg px-2.5 py-2 text-sm bg-background text-foreground min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Tüm diller</option>
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
              <label className="sr-only" htmlFor="search-year-from">Yıl başlangıç</label>
              <input
                id="search-year-from"
                name="year_from"
                type="number"
                defaultValue={sp.year_from}
                placeholder="Yıldan"
                min="1900"
                max="2030"
                className="border border-border rounded-lg px-2.5 py-2 text-sm w-24 min-h-[36px] bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-muted-foreground" aria-hidden>–</span>
              <label className="sr-only" htmlFor="search-year-to">Yıl bitiş</label>
              <input
                id="search-year-to"
                name="year_to"
                type="number"
                defaultValue={sp.year_to}
                placeholder="Yıla"
                min="1900"
                max="2030"
                className="border border-border rounded-lg px-2.5 py-2 text-sm w-24 min-h-[36px] bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input type="hidden" name="type" value={type} />
            </div>
          )}
        </form>

      {!q ? (
        <EmptySearch />
      ) : searchError ? (
        <CatalogErrorAlert message={searchError} className="mt-6" />
      ) : !hasResults ? (
        <NoResults q={q} />
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-6 min-w-0">
          <div
            className="mb-4 md:mb-5 pb-4 border-b border-border/80"
            id="search-results-heading"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {total.toLocaleString('tr-TR')}
              </span>
              {' sonuç bulundu'}
              <span className="hidden sm:inline"> — </span>
              <span className="block sm:inline mt-0.5 sm:mt-0">
                <span className="text-muted-foreground">Sorgu: </span>
                <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span>
                <span className="text-muted-foreground"> ({typeLabel})</span>
              </span>
            </p>
            {searchPersonalized && (
              <p className="mt-2 text-xs text-muted-foreground">
                Sonuçlar ilgi alanlarınıza göre önceliklendirildi.
                {' '}
                <Link href={qs({ personalize: '0', page: '1' })} className="text-primary hover:underline">
                  Tüm alanlarda göster
                </Link>
              </p>
            )}
          </div>

          {type === 'article' && (
            <>
              {searchPersonalized && interestArticleItems.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    İlgi alanlarınıza uygun sonuçlar ({articleResults.interestTotal?.toLocaleString('tr-TR') ?? interestArticleItems.length})
                  </h3>
                  <ul className="catalog-list">
                    {interestArticleItems.map((a) => (
                      <ArticleResultItem key={a.id} article={a} showCategory locale={locale} />
                    ))}
                  </ul>
                </section>
              )}
              {searchPersonalized && otherArticleItems.length > 0 && (
                <section className={interestArticleItems.length > 0 ? 'pt-4 border-t border-border/80' : ''}>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Diğer sonuçlar
                  </h3>
                  <ul className="catalog-list">
                    {otherArticleItems.map((a) => (
                      <ArticleResultItem key={a.id} article={a} showCategory locale={locale} />
                    ))}
                  </ul>
                </section>
              )}
              {!searchPersonalized && (
                <ul className="catalog-list">
                  {articleResults.data.map((a) => (
                    <ArticleResultItem key={a.id} article={a} locale={locale} />
                  ))}
                </ul>
              )}
            </>
          )}

          {type === 'journal' && (
            <>
              {searchPersonalized && interestJournalItems.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    İlgi alanlarınıza uygun dergiler ({journalResults.interestTotal?.toLocaleString('tr-TR') ?? interestJournalItems.length})
                  </h3>
                  <ul className="catalog-list">
                    {interestJournalItems.map((j) => (
                      <JournalResultItem key={j.id} journal={j} showCategory locale={locale} />
                    ))}
                  </ul>
                </section>
              )}
              {searchPersonalized && otherJournalItems.length > 0 && (
                <section className={interestJournalItems.length > 0 ? 'pt-4 border-t border-border/80' : ''}>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Diğer dergiler</h3>
                  <ul className="catalog-list">
                    {otherJournalItems.map((j) => (
                      <JournalResultItem key={j.id} journal={j} showCategory locale={locale} />
                    ))}
                  </ul>
                </section>
              )}
              {!searchPersonalized && (
                <ul className="catalog-list">
                  {journalResults.data.map((j) => (
                    <JournalResultItem key={j.id} journal={j} locale={locale} />
                  ))}
                </ul>
              )}
            </>
          )}

          {type === 'author' && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 min-w-0">
              {authorResults.data.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/authors/${a.slug ?? a.id}-${a.id}`}
                    className="flex items-center gap-3 py-2 min-h-[44px] no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group"
                  >
                    <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {a.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} qs={qs} />
          )}
        </div>
      )}
    </div>
  )
}

function ArticleResultItem({
  article,
  showCategory = false,
  locale,
}: {
  article: Awaited<ReturnType<typeof searchArticles>>['data'][number]
  showCategory?: boolean
  locale: SiteLocale
}) {
  const title = pickLocalizedArticleDisplayTitle(article.title_tr, article.title_en, locale)
  const href = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const authors = formatAuthors(article.authors_raw)

  const keywords = article.keywords_tr
    ?.replace(/anahtar kelimeler[:;]?/i, '')
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5) ?? []

  return (
    <li className="catalog-list-item group min-w-0">
      <Link
        href={href}
        className="block no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <h2 className="text-base font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-3">
          {title}
        </h2>
      </Link>

      <div className="mt-2.5 space-y-1.5 min-w-0">
        {(authors || article.published_year) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-[0.8125rem] text-foreground/70">
            {authors && <span className="min-w-0">{authors}</span>}
            {authors && article.published_year && (
              <span className="text-muted-foreground" aria-hidden>·</span>
            )}
            {article.published_year && (
              <span className="tabular-nums shrink-0 text-muted-foreground">
                {article.published_year}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 min-w-0">
          {article.journal_title && article.journal_slug && article.journal_id && (
            <Link
              href={`/journals/${article.journal_slug}-${article.journal_id}`}
              title={article.journal_title}
              className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-foreground/75 hover:text-foreground line-clamp-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
            >
              {article.journal_title}
            </Link>
          )}
          {showCategory && article.category_label && (
            <Badge variant="secondary" className="text-[0.6875rem] shrink-0">
              {article.category_label}
            </Badge>
          )}
          <CatalogPdfLink href={`/pdfs/${article.id}`} label={`${title} — tam metin PDF`} />
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {keywords.map((kw, i) => (
              <Link
                key={i}
                href={`/search?q=${encodeURIComponent(kw)}&area=keywords`}
                className="no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Badge
                  variant="outline"
                  className="text-[0.6875rem] cursor-pointer hover:bg-secondary text-muted-foreground"
                >
                  {kw}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function JournalResultItem({
  journal,
  showCategory = false,
  locale,
}: {
  journal: Awaited<ReturnType<typeof searchJournals>>['data'][number]
  showCategory?: boolean
  locale: SiteLocale
}) {
  const title = pickLocalizedTitle(journal.title_tr, journal.title_en, locale)
  return (
    <li className="catalog-list-item">
      <Link
        href={`/journals/${journal.slug}-${journal.id}`}
        className="font-medium text-foreground hover:text-primary transition-colors no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {title}
      </Link>
      <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
        {journal.issn && <Badge variant="outline" className="text-xs">ISSN: {journal.issn}</Badge>}
        {showCategory && journal.category_label && (
          <Badge variant="secondary" className="text-xs">{journal.category_label}</Badge>
        )}
        {journal.publisher && <span>{journal.publisher}</span>}
      </div>
    </li>
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

  const linkClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'min-w-[36px] min-h-[36px] justify-center shrink-0',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  )
  const activeClass = cn(
    buttonVariants({ variant: 'default', size: 'sm' }),
    'min-w-[36px] min-h-[36px] justify-center shrink-0 pointer-events-none',
  )
  const disabledClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'min-w-[36px] min-h-[36px] justify-center shrink-0 opacity-50 cursor-not-allowed',
  )

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1 mt-8 max-w-full overflow-x-auto px-1"
      aria-label="Sayfalama"
    >
      {page > 1 ? (
        <Link href={qs({ page: String(page - 1) })} className={linkClass} aria-label="Önceki sayfa">
          ←
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true" aria-label="Önceki sayfa">
          ←
        </span>
      )}

      {pages.map((p) => (
        p === page ? (
          <span key={p} className={activeClass} aria-current="page">
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={qs({ page: String(p) })}
            className={linkClass}
            aria-label={`Sayfa ${p}`}
          >
            {p}
          </Link>
        )
      ))}

      {page < totalPages ? (
        <Link href={qs({ page: String(page + 1) })} className={linkClass} aria-label="Sonraki sayfa">
          →
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true" aria-label="Sonraki sayfa">
          →
        </span>
      )}
    </nav>
  )
}

function EmptySearch() {
  return (
    <div className="catalog-empty-panel max-w-lg mx-auto">
      <Search className="h-10 w-10 mx-auto text-brand-accent/50 mb-4" aria-hidden />
      <h2 className="text-lg font-medium text-foreground mb-2">Aramak istediğinizi yazın</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Makale başlığı, yazar adı, ISSN veya anahtar kelime ile arama yapabilirsiniz.
        Gelişmiş arama için{' '}
        <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">author:Smith</code> veya{' '}
        <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">title:makale</code> kullanın.
      </p>
    </div>
  )
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="catalog-empty-panel max-w-lg mx-auto text-left">
      <Search className="h-10 w-10 mx-auto text-brand-accent/50 mb-4" aria-hidden />
      <h2 className="text-lg font-medium text-foreground mb-2 text-center">
        Sonuç bulunamadı
      </h2>
      <p className="text-sm text-muted-foreground mb-4 text-center">
        <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span> için eşleşen kayıt yok.
      </p>
      <ul className="text-sm text-muted-foreground space-y-2 text-left list-disc pl-5 mx-auto max-w-sm">
        <li>Yazımı kontrol edin (Türkçe karakterler: ğ, ü, ş, ı, ö, ç).</li>
        <li>Daha kısa veya farklı bir anahtar kelime deneyin.</li>
        <li>Arama alanı filtresini genişletin (ör. &ldquo;Başlık, yazar, anahtar kelime&rdquo;).</li>
      </ul>
      <p className="text-sm text-muted-foreground mt-5 text-center">
        Yukarıdaki arama kutusundan yeni bir sorgu girebilirsiniz.
      </p>
    </div>
  )
}
