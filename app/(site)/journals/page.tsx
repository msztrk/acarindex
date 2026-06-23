import type { Metadata } from 'next'
import Link from 'next/link'
import * as journalData from '@/lib/data/journals'
import * as catalogData from '@/lib/data/catalog'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, buttonVariants } from '@/lib/utils'
import type { Journal, Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Dergiler — AcarIndex',
  description: 'AcarIndex\'te indekslenmiş tüm akademik dergilere göz atın.',
}

const PER_PAGE = 60

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

async function getJournals(categoryId?: number, q?: string, page = 1) {
  return journalData.listJournalsPaginated({
    categoryId,
    q,
    page,
    perPage: PER_PAGE,
  })
}

async function getCategories() {
  return catalogData.listActiveCategories()
}

export default async function JournalsPage({ searchParams }: PageProps) {
  const { category, q, page: pageStr } = await searchParams
  const categoryId = category ? parseInt(category, 10) : undefined
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))

  const [{ journals, total }, categories] = await Promise.all([
    getJournals(isNaN(categoryId ?? NaN) ? undefined : categoryId, q, page),
    getCategories(),
  ])

  const totalPages = Math.ceil(total / PER_PAGE)

  function qs(overrides: Record<string, string | undefined>) {
    const base: Record<string, string> = {}
    if (q) base.q = q
    if (category) base.category = category
    const merged = { ...base, ...overrides }
    return '/journals?' + new URLSearchParams(
      Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)) as Record<string, string>
    ).toString()
  }

  return (
    <div className="content-width py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2">Dergiler</h1>
        <p className="text-muted-foreground">
          {total.toLocaleString('tr-TR')} dergi • Sayfa {page}/{totalPages}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Filtre sidebar */}
        <aside>
          {/* Arama */}
          <form method="GET" className="mb-6">
            {category && <input type="hidden" name="category" value={category} />}
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background focus-within:ring-2 focus-within:ring-ring">
              <Search className="ml-3 h-4 w-4 text-muted-foreground shrink-0" />
              <input
                name="q"
                defaultValue={q}
                type="search"
                placeholder="Dergi ara…"
                className="flex-1 px-2 py-2 text-sm bg-transparent outline-none"
              />
            </div>
          </form>

          {/* Kategoriler */}
          {categories.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Kategoriler
              </h2>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/journals"
                    className={`block text-sm px-2 py-1.5 rounded transition-colors ${!category ? 'text-primary font-medium bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                  >
                    Tümü
                  </Link>
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/journals?category=${cat.id}`}
                      className={`block text-sm px-2 py-1.5 rounded transition-colors ${String(categoryId) === String(cat.id) ? 'text-primary font-medium bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                    >
                      {cat.name_tr ?? cat.name_en}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Liste */}
        <div>
          {journals.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Dergi bulunamadı.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {journals.map((journal) => (
                  <JournalCard key={journal.id} journal={journal} />
                ))}
              </div>

              {/* Sayfalama */}
              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Sayfalama">
                  {page > 1 && (
                    <Link href={qs({ page: String(page - 1) })}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  )}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1
                      : page <= 4 ? i + 1
                      : page >= totalPages - 3 ? totalPages - 6 + i
                      : page - 3 + i
                    return (
                      <Link key={p} href={qs({ page: String(p) })}
                        className={cn(
                          buttonVariants({ variant: p === page ? 'default' : 'outline', size: 'sm' }),
                          'min-w-[36px] justify-center'
                        )}>
                        {p}
                      </Link>
                    )
                  })}
                  {page < totalPages && (
                    <Link href={qs({ page: String(page + 1) })}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function JournalCard({ journal }: { journal: Partial<Journal> }) {
  const title = journal.title_tr ?? journal.title_en ?? 'Başlıksız'
  const href = `/journals/${journal.slug}-${journal.id}`

  return (
    <Link
      href={href}
      className="group flex gap-3 p-4 rounded-xl border border-border bg-card hover:border-accent/50 hover:shadow-sm transition-all no-underline"
    >
      {/* Kapak küçük */}
      <div className="shrink-0 w-10 h-14 bg-secondary rounded flex items-center justify-center border border-border">
        {journal.cover_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://www.acarindex.com/${journal.cover_path}`}
            alt={title}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-snug mb-1">
          {title}
        </h2>
        {journal.issn && (
          <p className="text-xs text-muted-foreground">ISSN: {journal.issn}</p>
        )}
        {journal.publisher && (
          <p className="text-xs text-muted-foreground truncate">{journal.publisher}</p>
        )}
        {journal.frequency && (
          <Badge variant="secondary" className="text-xs mt-1">{journal.frequency}</Badge>
        )}
      </div>
    </Link>
  )
}
