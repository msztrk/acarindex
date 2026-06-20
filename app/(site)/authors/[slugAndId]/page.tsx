import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { User, BookOpen, FileText } from 'lucide-react'
import type { Author, Article } from '@/types/database'

// ─── URL: /authors/{slug}-{id}  veya  /authors/{id} ─────────────────────────
function extractAuthorId(slugAndId: string): number | null {
  // "{slug}-{id}"
  const m = slugAndId.match(/(?:^|-?)(\d+)$/)
  if (m) return parseInt(m[1], 10)
  return null
}

// ─── Veri ────────────────────────────────────────────────────────────────────
async function getAuthor(id: number) {
  const sb = await createClient()
  const { data, error } = await sb
    .from('authors')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as Author
}

async function getAuthorArticles(authorId: number) {
  const sb = await createClient()
  const { data } = await sb
    .from('article_authors')
    .select(`
      position,
      article:articles (
        id, slug, legacy_journal_slug, title_tr, title_en, published_year, authors_raw,
        journal:journals!journal_id ( id, slug, title_tr )
      )
    `)
    .eq('author_id', authorId)
    .order('position', { ascending: true })
    .limit(100)

  return (data ?? []).map((row: Record<string, unknown>) => row.article as Partial<Article> & {
    journal: { id: number; slug: string; title_tr: string | null } | null
  }).filter(Boolean)
}

// ─── Metadata ────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slugAndId: string }>
}): Promise<Metadata> {
  const { slugAndId } = await params
  const id = extractAuthorId(slugAndId)
  if (!id) return {}
  const author = await getAuthor(id)
  if (!author) return {}

  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const canonicalSlug = author.slug ? `${author.slug}-${author.id}` : String(author.id)

  return {
    title: author.name,
    description: author.bio?.slice(0, 160) ?? `${author.name} — AcarIndex yazar profili`,
    alternates: { canonical: `${canonicalBase}/authors/${canonicalSlug}` },
    openGraph: {
      title: author.name,
      type: 'profile',
      firstName: author.name.split(' ')[0],
      lastName: author.name.split(' ').slice(1).join(' ') || undefined,
    },
  }
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────
export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slugAndId: string }>
}) {
  const { slugAndId } = await params
  const id = extractAuthorId(slugAndId)
  if (!id) notFound()

  const [author, articles] = await Promise.all([
    getAuthor(id),
    getAuthorArticles(id),
  ])

  if (!author) notFound()

  // Yıllık istatistikler
  const articlesByYear = articles.reduce<Record<number, number>>((acc, a) => {
    const y = a.published_year ?? 0
    acc[y] = (acc[y] ?? 0) + 1
    return acc
  }, {})
  const years = Object.keys(articlesByYear).map(Number).sort((a, b) => b - a)

  // Dergi çeşitliliği
  const journalSet = new Set(articles.map(a => a.journal?.id).filter(Boolean))

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    jobTitle: author.title ?? undefined,
    affiliation: author.institution ? { '@type': 'Organization', name: author.institution } : undefined,
    url: `${process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'}/authors/${author.slug ?? author.id}-${author.id}`,
  }

  return (
    <>
      <JsonLd data={schema} />
      <div className="content-width py-6 lg:py-10">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/">Ana Sayfa</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{author.name}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
          {/* Ana içerik */}
          <div>
            {/* Profil başlığı */}
            <div className="flex items-start gap-5 mb-8">
              <div className="h-16 w-16 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold mb-1">{author.name}</h1>
                {author.title && (
                  <p className="text-sm text-muted-foreground mb-1">{author.title}</p>
                )}
                {author.institution && (
                  <p className="text-sm text-muted-foreground">{author.institution}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {author.orcid && (
                    <a
                      href={`https://orcid.org/${author.orcid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      ORCID: {author.orcid}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {author.bio && (
              <section className="mb-8">
                <h2 className="text-base font-serif font-semibold mb-2">Hakkında</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{author.bio}</p>
              </section>
            )}

            <Separator className="mb-6" />

            {/* Makaleler */}
            <section>
              <h2 className="text-base font-serif font-semibold mb-4">
                Makaleler{' '}
                <Badge variant="secondary">{articles.length}</Badge>
              </h2>

              {articles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz makale bulunamadı.</p>
              ) : (
                <div className="space-y-3">
                  {articles.map((a) => {
                    const title = a.title_tr ?? a.title_en ?? 'Başlıksız'
                    const href = `/${a.legacy_journal_slug}/${a.slug}-${a.id}`
                    return (
                      <div key={a.id} className="p-3 rounded-lg border border-border hover:border-accent/40 transition-colors">
                        <Link href={href} className="text-sm font-medium text-primary hover:text-accent block mb-1 leading-snug">
                          {title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {a.journal && (
                            <Link href={`/journals/${a.journal.slug}-${a.journal.id}`} className="hover:text-foreground flex items-center gap-0.5">
                              <BookOpen className="h-3 w-3" />
                              {a.journal.title_tr}
                            </Link>
                          )}
                          {a.published_year && <span>{a.published_year}</span>}
                          <Link href={`/pdfs/${a.id}`} className="text-accent hover:underline flex items-center gap-0.5">
                            <FileText className="h-3 w-3" /> PDF
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-border p-4 bg-card">
              <h3 className="text-sm font-semibold mb-3">İstatistikler</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Makale</dt>
                  <dd className="font-medium">{articles.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Dergi</dt>
                  <dd className="font-medium">{journalSet.size}</dd>
                </div>
                {years[0] && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Son yayın</dt>
                    <dd className="font-medium">{years[0]}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Yıl dağılımı */}
            {years.length > 0 && (
              <div className="rounded-lg border border-border p-4 bg-card">
                <h3 className="text-sm font-semibold mb-3">Yıllara Göre</h3>
                <ul className="space-y-1">
                  {years.slice(0, 10).map((y) => (
                    <li key={y} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{y || 'Tarihsiz'}</span>
                      <Badge variant="outline" className="text-xs">{articlesByYear[y]}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
