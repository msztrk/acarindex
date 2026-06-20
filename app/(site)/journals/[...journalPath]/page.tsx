import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseJournalSegment } from '@/lib/urls/journal'
import { cn, buttonVariants } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { BookOpen, FileText, ChevronRight } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import type { Journal, Issue, Article } from '@/types/database'

// ─── URL çözümleme ───────────────────────────────────────────────────────────
// /journals/{slug}-{id}              → home
// /journals/{slug}-{id}/arsiv        → arsiv
// /journals/{slug}-{id}/sayi/{arsivId} → sayi
// /journals/{slug}-{id}/amac-kapsam  → amac-kapsam
// /journals/{slug}-{id}/editor-kurulu
// /journals/{slug}-{id}/yazim-kurallari
// /journals/{slug}-{id}/iletisim

type SubPage = 'home' | 'arsiv' | 'sayi' | 'amac-kapsam' | 'editor-kurulu' | 'yazim-kurallari' | 'iletisim'

interface ResolvedPath {
  journalSegment: string  // "{slug}-{id}"
  subPage: SubPage
  issueId?: number
}

function resolvePath(segments: string[]): ResolvedPath | null {
  if (!segments || segments.length === 0) return null
  const [journalSegment, sub, ...rest] = segments

  if (!parseJournalSegment(journalSegment)) return null

  if (!sub) return { journalSegment, subPage: 'home' }
  if (sub === 'arsiv') return { journalSegment, subPage: 'arsiv' }
  if (sub === 'amac-kapsam') return { journalSegment, subPage: 'amac-kapsam' }
  if (sub === 'editor-kurulu') return { journalSegment, subPage: 'editor-kurulu' }
  if (sub === 'yazim-kurallari') return { journalSegment, subPage: 'yazim-kurallari' }
  if (sub === 'iletisim') return { journalSegment, subPage: 'iletisim' }
  if (sub === 'sayi' && rest[0]) {
    const issueId = parseInt(rest[0], 10)
    if (!isNaN(issueId)) return { journalSegment, subPage: 'sayi', issueId }
  }
  return null
}

// ─── Veri ────────────────────────────────────────────────────────────────────
async function getJournal(journalId: number) {
  const sb = await createClient()
  const { data } = await sb.from('journals').select('*').eq('id', journalId).eq('status', 'published').single()
  return data as Journal | null
}

async function getIssues(journalId: number) {
  const sb = await createClient()
  const { data } = await sb
    .from('issues')
    .select('*')
    .eq('journal_id', journalId)
    .eq('status', 'published')
    .order('year', { ascending: false })
  return (data ?? []) as Issue[]
}

async function getIssueArticles(issueId: number) {
  const sb = await createClient()
  const { data } = await sb
    .from('articles')
    .select('id, slug, legacy_journal_slug, title_tr, title_en, authors_raw, page_start, page_end, published_year')
    .eq('issue_id', issueId)
    .eq('status', 'published')
    .order('page_start', { ascending: true })
  return (data ?? []) as Partial<Article>[]
}

async function getLatestArticles(journalId: number, limit = 10) {
  const sb = await createClient()
  const { data } = await sb
    .from('articles')
    .select('id, slug, legacy_journal_slug, title_tr, title_en, authors_raw, published_year, issue_id')
    .eq('journal_id', journalId)
    .eq('status', 'published')
    .order('published_year', { ascending: false })
    .limit(limit)
  return (data ?? []) as Partial<Article>[]
}

// ─── Metadata ────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ journalPath: string[] }>
}): Promise<Metadata> {
  const { journalPath } = await params
  const resolved = resolvePath(journalPath)
  if (!resolved) return {}

  const parsed = parseJournalSegment(resolved.journalSegment)
  if (!parsed) return {}

  const journal = await getJournal(parsed.journalId)
  if (!journal) return {}

  const title = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const subSuffix = resolved.subPage !== 'home' ? `/${resolved.subPage}` : ''
  const canonicalUrl = `${canonicalBase}/journals/${resolved.journalSegment}${subSuffix}`

  return {
    title,
    description: journal.description?.slice(0, 160) ?? undefined,
    alternates: { canonical: canonicalUrl },
  }
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────
export default async function JournalPage({
  params,
}: {
  params: Promise<{ journalPath: string[] }>
}) {
  const { journalPath } = await params
  const resolved = resolvePath(journalPath)
  if (!resolved) notFound()

  const parsed = parseJournalSegment(resolved.journalSegment)!
  const journal = await getJournal(parsed.journalId)
  if (!journal) notFound()

  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const journalBase = `${canonicalBase}/journals/${resolved.journalSegment}`
  const title = journal.title_tr ?? journal.title_en ?? 'Dergi'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name: title,
    issn: journal.issn ?? undefined,
    publisher: { '@type': 'Organization', name: journal.publisher ?? title },
    url: journalBase,
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
            <BreadcrumbItem><BreadcrumbLink href="/journals">Dergiler</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate max-w-[220px]">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Dergi başlığı */}
        <div className="mb-8 flex flex-col sm:flex-row gap-6">
          <div className="shrink-0 w-20 h-28 bg-secondary rounded-lg border border-border flex items-center justify-center">
            {journal.cover_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://www.acarindex.com/${journal.cover_path}`} alt={title} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">{title}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              {journal.issn && <Badge variant="outline">ISSN: {journal.issn}</Badge>}
              {journal.eissn && <Badge variant="outline">E-ISSN: {journal.eissn}</Badge>}
              {journal.frequency && <Badge variant="secondary">{journal.frequency}</Badge>}
            </div>
            {journal.publisher && (
              <p className="text-sm text-muted-foreground">{journal.publisher}</p>
            )}
          </div>
        </div>

        {/* Navigasyon sekmeleri */}
        <JournalNav segment={resolved.journalSegment} active={resolved.subPage} />
        <Separator className="mb-8" />

        {/* İçerik */}
        {resolved.subPage === 'home' && (
          <JournalHome journal={journal} journalId={parsed.journalId} segment={resolved.journalSegment} />
        )}
        {resolved.subPage === 'arsiv' && (
          <JournalArsiv journalId={parsed.journalId} segment={resolved.journalSegment} />
        )}
        {resolved.subPage === 'sayi' && resolved.issueId && (
          <JournalSayi issueId={resolved.issueId} />
        )}
        {resolved.subPage === 'amac-kapsam' && (
          <CmsSection title="Amaç ve Kapsam" html={journal.aim_and_scope} />
        )}
        {resolved.subPage === 'editor-kurulu' && (
          <CmsSection title="Editör Kurulu" html={journal.editorial_board} />
        )}
        {resolved.subPage === 'yazim-kurallari' && (
          <CmsSection title="Yazım Kuralları" html={journal.writing_rules} />
        )}
        {resolved.subPage === 'iletisim' && (
          <CmsSection title="İletişim" html={journal.contact_text} />
        )}
      </div>
    </>
  )
}

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function JournalNav({ segment, active }: { segment: string; active: SubPage }) {
  const base = `/journals/${segment}`
  const links: { label: string; href: string; key: SubPage }[] = [
    { label: 'Dergi', href: base, key: 'home' },
    { label: 'Arşiv', href: `${base}/arsiv`, key: 'arsiv' },
    { label: 'Amaç & Kapsam', href: `${base}/amac-kapsam`, key: 'amac-kapsam' },
    { label: 'Editör Kurulu', href: `${base}/editor-kurulu`, key: 'editor-kurulu' },
    { label: 'Yazım Kuralları', href: `${base}/yazim-kurallari`, key: 'yazim-kurallari' },
    { label: 'İletişim', href: `${base}/iletisim`, key: 'iletisim' },
  ]
  return (
    <nav className="flex gap-1 flex-wrap mb-4">
      {links.map(({ label, href, key }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            'text-sm px-3 py-1.5 rounded-md transition-colors',
            active === key
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

async function JournalHome({
  journal,
  journalId,
  segment,
}: {
  journal: Journal
  journalId: number
  segment: string
}) {
  const [issues, articles] = await Promise.all([
    getIssues(journalId),
    getLatestArticles(journalId, 10),
  ])

  const latestIssue = issues[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
      <div>
        {journal.description && (
          <section className="mb-8">
            <h2 className="text-lg font-serif font-semibold mb-3">Dergi Hakkında</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{journal.description}</p>
          </section>
        )}

        <section>
          <h2 className="text-lg font-serif font-semibold mb-4">Son Makaleler</h2>
          <div className="space-y-3">
            {articles.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz makale yok.</p>
            )}
            {articles.map((a) => (
              <ArticleRow key={a.id} article={a} />
            ))}
          </div>
          <Link
            href={`/journals/${segment}/arsiv`}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-4"
          >
            Tüm sayıları gör <ChevronRight className="h-3 w-3" />
          </Link>
        </section>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        {latestIssue && (
          <div className="rounded-lg border border-border p-4 bg-card">
            <h3 className="text-sm font-semibold mb-2">Son Sayı</h3>
            <Link
              href={`/journals/${segment}/sayi/${latestIssue.id}`}
              className="text-sm text-primary hover:text-accent"
            >
              {latestIssue.issue_label ?? `${latestIssue.year ?? ''}`}
            </Link>
          </div>
        )}
        <div className="rounded-lg border border-border p-4 bg-card text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-sm mb-2">Dergi Bilgisi</p>
          {journal.issn && <p><span className="font-medium">ISSN:</span> {journal.issn}</p>}
          {journal.eissn && <p><span className="font-medium">E-ISSN:</span> {journal.eissn}</p>}
          {journal.publisher && <p><span className="font-medium">Yayıncı:</span> {journal.publisher}</p>}
          {journal.frequency && <p><span className="font-medium">Periyot:</span> {journal.frequency}</p>}
        </div>
      </aside>
    </div>
  )
}

async function JournalArsiv({ journalId, segment }: { journalId: number; segment: string }) {
  const issues = await getIssues(journalId)

  // Yıla göre grupla
  const byYear = issues.reduce<Record<number, Issue[]>>((acc, issue) => {
    const year = issue.year ?? 0
    if (!acc[year]) acc[year] = []
    acc[year].push(issue)
    return acc
  }, {})

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold mb-6">Arşiv</h2>
      {years.length === 0 && <p className="text-sm text-muted-foreground">Arşiv bulunamadı.</p>}
      <div className="space-y-6">
        {years.map((year) => (
          <div key={year}>
            <h3 className="text-base font-semibold text-foreground mb-2 border-b border-border pb-1">
              {year || 'Tarihsiz'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {byYear[year].map((issue) => (
                <Link
                  key={issue.id}
                  href={`/journals/${segment}/sayi/${issue.id}`}
                  className="text-sm text-primary hover:text-accent p-2 rounded hover:bg-secondary transition-colors"
                >
                  {issue.issue_label ?? `${year}`}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function JournalSayi({ issueId }: { issueId: number }) {
  const sb = await createClient()
  const { data: issue } = await sb.from('issues').select('*').eq('id', issueId).single()
  const articles = await getIssueArticles(issueId)

  if (!issue) return <p className="text-sm text-muted-foreground">Sayı bulunamadı.</p>

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold mb-6">
        {(issue as Issue).issue_label ?? `${(issue as Issue).year ?? ''}`}
      </h2>
      {articles.length === 0 && (
        <p className="text-sm text-muted-foreground">Bu sayıda makale bulunamadı.</p>
      )}
      <div className="space-y-3">
        {articles.map((a) => <ArticleRow key={a.id} article={a} />)}
      </div>
    </div>
  )
}

function CmsSection({ title, html }: { title: string; html: string | null | undefined }) {
  if (!html) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">Bu bölüm henüz doldurulmamış.</p>
      </div>
    )
  }
  return (
    <div>
      <h2 className="text-lg font-serif font-semibold mb-4">{title}</h2>
      <div
        className="prose prose-sm max-w-none text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function ArticleRow({ article }: { article: Partial<Article> }) {
  const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
  const href = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const authors = article.authors_raw
    ?.split(',')
    .slice(0, 3)
    .map((a) => a.trim())
    .join(', ') ?? ''

  return (
    <div className="p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-secondary/50 transition-colors">
      <Link href={href} className="text-sm font-medium text-primary hover:text-accent leading-snug block mb-1">
        {title}
      </Link>
      {authors && <p className="text-xs text-muted-foreground">{authors}</p>}
      <div className="flex items-center gap-2 mt-1">
        {article.published_year && (
          <span className="text-xs text-muted-foreground">{article.published_year}</span>
        )}
        {article.page_start && (
          <span className="text-xs text-muted-foreground">ss. {article.page_start}–{article.page_end}</span>
        )}
        <Link href={`/pdfs/${article.id}`} className="text-xs text-accent flex items-center gap-0.5 hover:underline ml-auto">
          <FileText className="h-3 w-3" /> PDF
        </Link>
      </div>
    </div>
  )
}
