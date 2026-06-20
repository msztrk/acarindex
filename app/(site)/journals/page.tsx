import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Search } from 'lucide-react'
import type { Journal, Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Dergiler — AcarIndex',
  description: 'AcarIndex\'te indekslenmiş tüm akademik dergilere göz atın.',
}

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string }>
}

async function getJournals(categoryId?: number, q?: string) {
  const sb = await createClient()
  let query = sb
    .from('journals')
    .select('id, slug, title_tr, title_en, issn, eissn, publisher, frequency, cover_path, hit_count, category_id')
    .eq('status', 'published')
    .order('title_tr', { ascending: true })

  if (categoryId) query = query.eq('category_id', categoryId)
  if (q) query = query.ilike('title_tr', `%${q}%`)

  const { data } = await query.limit(200)
  return (data ?? []) as Partial<Journal>[]
}

async function getCategories() {
  const sb = await createClient()
  const { data } = await sb.from('categories').select('id, name_tr, name_en').eq('active', true).order('name_tr')
  return (data ?? []) as Partial<Category>[]
}

export default async function JournalsPage({ searchParams }: PageProps) {
  const { category, q } = await searchParams
  const categoryId = category ? parseInt(category, 10) : undefined
  const [journals, categories] = await Promise.all([
    getJournals(isNaN(categoryId ?? NaN) ? undefined : categoryId, q),
    getCategories(),
  ])

  return (
    <div className="content-width py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2">Dergiler</h1>
        <p className="text-muted-foreground">
          {journals.length.toLocaleString('tr-TR')} dergi listeleniyor
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Filtre sidebar */}
        <aside>
          {/* Arama */}
          <form method="GET" className="mb-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {journals.map((journal) => (
                <JournalCard key={journal.id} journal={journal} />
              ))}
            </div>
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
