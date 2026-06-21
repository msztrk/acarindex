import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseJournalSegment } from '@/lib/urls/journal'
import { cn, buttonVariants } from '@/lib/utils'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { BookOpen, FileText, ChevronRight, ExternalLink } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import type { Journal, Issue, Article } from '@/types/database'
import type { ReactNode } from 'react'
import { cache } from 'react'

// ─── URL çözümleme ───────────────────────────────────────────────────────────

type SubPage = 'home' | 'arsiv' | 'sayi' | 'amac-kapsam' | 'editor-kurulu' | 'yazim-kurallari' | 'iletisim'

interface ResolvedPath {
  journalSegment: string
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

const linkFocusClass =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

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

async function getIssueArticlesUncached(issueId: number) {
  const sb = await createClient()
  const { data } = await sb
    .from('articles')
    .select('id, slug, legacy_journal_slug, title_tr, title_en, authors_raw, page_start, page_end, published_year')
    .eq('issue_id', issueId)
    .eq('status', 'published')
    .order('page_start', { ascending: true })
  return (data ?? []) as Partial<Article>[]
}

const getIssueArticles = cache(getIssueArticlesUncached)

async function getIssueUncached(issueId: number) {
  const sb = await createClient()
  const { data } = await sb
    .from('issues')
    .select('*')
    .eq('id', issueId)
    .eq('status', 'published')
    .single()
  return data as Issue | null
}

const getIssue = cache(getIssueUncached)

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

function parseIssueCitationParts(issue: Issue): {
  volumeLabel: string | null
  issueNumLabel: string | null
  year: number | null
} {
  const year = issue.year ?? null
  let volumeLabel = issue.volume?.trim() || null
  let issueNumLabel: string | null = null
  const raw = issue.issue_number?.trim()

  if (raw) {
    const ciltMatch = raw.match(/Cilt:\s*([^,-]+)/i)
    const sayiMatch = raw.match(/Sayı:\s*(\S+)/i)
    if (ciltMatch) volumeLabel = ciltMatch[1].trim()
    if (sayiMatch) issueNumLabel = sayiMatch[1].trim()
    if (!sayiMatch && !ciltMatch) issueNumLabel = raw
  }

  return { volumeLabel, issueNumLabel, year }
}

function buildIssueMetadataTitle(journalTitle: string, issue: Issue): string {
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const detailParts: string[] = []

  if (volumeLabel && issueNumLabel) {
    detailParts.push(`Cilt ${volumeLabel}, Sayı ${issueNumLabel}`)
  } else if (issueNumLabel) {
    detailParts.push(`Sayı ${issueNumLabel}`)
  } else if (volumeLabel) {
    detailParts.push(`Cilt ${volumeLabel}`)
  } else if (issue.issue_label?.trim()) {
    detailParts.push(issue.issue_label.trim())
  }

  if (detailParts.length === 0) {
    return year ? `${journalTitle} (${year})` : journalTitle
  }

  return year
    ? `${journalTitle} — ${detailParts[0]} (${year})`
    : `${journalTitle} — ${detailParts[0]}`
}

function buildIssueMetadataDescription(
  journalTitle: string,
  issue: Issue,
  articleCount: number,
): string | undefined {
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const issueBits: string[] = []
  if (volumeLabel) issueBits.push(`Cilt ${volumeLabel}`)
  if (issueNumLabel) issueBits.push(`Sayı ${issueNumLabel}`)
  const issueStr = issueBits.join(' ') || issue.issue_label?.trim()

  if (!issueStr && !year) return undefined

  let desc = journalTitle
  if (issueStr) desc += `, ${issueStr}`
  if (year) desc += ` (${year})`
  desc += ' içinde yayımlanan'
  if (articleCount > 0) {
    desc += ` ${articleCount} akademik makaleyi inceleyin.`
  } else {
    desc += ' akademik makaleleri inceleyin.'
  }
  return desc.slice(0, 160)
}

function buildJournalCanonicalPath(
  resolved: ResolvedPath,
  journalPath: string[],
): string {
  if (resolved.subPage === 'home') {
    return `/journals/${resolved.journalSegment}`
  }
  return `/journals/${journalPath.join('/')}`
}

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

  const journalTitle = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const canonicalPath = buildJournalCanonicalPath(resolved, journalPath)
  const canonicalUrl = `${canonicalBase}${canonicalPath}`

  if (resolved.subPage === 'sayi' && resolved.issueId) {
    const issue = await getIssue(resolved.issueId)
    if (!issue) return { title: 'Sayı bulunamadı' }

    const articles = await getIssueArticles(resolved.issueId)
    const pageTitle = buildIssueMetadataTitle(journalTitle, issue)
    const description = buildIssueMetadataDescription(journalTitle, issue, articles.length)

    return {
      title: pageTitle,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: pageTitle,
        description,
        url: canonicalPath,
      },
    }
  }

  return {
    title: journalTitle,
    description: journal.description?.slice(0, 160) ?? undefined,
    alternates: { canonical: canonicalUrl },
  }
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function formatAuthors(raw: string | null | undefined, max = 3): string {
  if (!raw) return ''
  return [...new Set(raw.split(/[,;]+/).map((a) => a.trim()).filter(Boolean))]
    .slice(0, max)
    .join(', ')
}

function formatPageRange(start?: number | null, end?: number | null): string | null {
  if (start && end) return `${start}–${end}`
  if (start) return String(start)
  if (end) return String(end)
  return null
}

function MetadataItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5 min-w-0">{children}</dd>
    </div>
  )
}

function JournalMetadataGrid({ journal }: { journal: Journal }) {
  const website = journal.legacy_link?.trim()
  const hasWebsite = website && /^https?:\/\//i.test(website)

  const items = [
    journal.publisher && { label: 'Yayıncı', value: journal.publisher },
    journal.issn && { label: 'ISSN', value: journal.issn },
    journal.eissn && { label: 'e-ISSN', value: journal.eissn },
    journal.publish_language && { label: 'Yayın dili', value: journal.publish_language },
    journal.frequency && { label: 'Yayın periyodu', value: journal.frequency },
    journal.start_year && { label: 'Başlangıç yılı', value: journal.start_year },
    journal.subject_category && { label: 'Konu alanı', value: journal.subject_category },
    hasWebsite && {
      label: 'Web sitesi',
      value: (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-flex items-center gap-1 text-primary hover:text-accent break-all no-underline', linkFocusClass)}
        >
          {website.replace(/^https?:\/\//i, '').slice(0, 48)}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
      ),
    },
  ].filter(Boolean) as Array<{ label: string; value: ReactNode }>

  if (items.length === 0) return null

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
      {items.map((item) => (
        <MetadataItem key={item.label} label={item.label}>
          {typeof item.value === 'string' ? item.value : item.value}
        </MetadataItem>
      ))}
    </dl>
  )
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
  const breadcrumbTitle =
    title.length > 48 ? `${title.slice(0, 45).trimEnd()}…` : title

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
      <div className="content-width py-6 lg:py-10 min-w-0">
        {resolved.subPage === 'sayi' && resolved.issueId ? (
          <>
            <JournalNav segment={resolved.journalSegment} active={resolved.subPage} />
            <div className="border-b border-border/80 mb-6 md:mb-8" />
            <JournalSayi
              journal={journal}
              issueId={resolved.issueId}
              segment={resolved.journalSegment}
            />
          </>
        ) : (
          <>
            <Breadcrumb className="mb-5 md:mb-6 min-w-0" aria-label="Breadcrumb">
              <BreadcrumbList className="min-w-0">
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" className={linkFocusClass}>Ana Sayfa</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/journals" className={linkFocusClass}>Dergiler</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0 max-w-[50%] sm:max-w-md">
                  <BreadcrumbPage className="line-clamp-1" title={title}>
                    {breadcrumbTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <header className="mb-6 md:mb-8 flex flex-col sm:flex-row gap-5 sm:gap-6 min-w-0">
              <div className="shrink-0 w-20 h-28 sm:w-[5.5rem] sm:h-[7.75rem] bg-secondary rounded-lg border border-border/80 flex items-center justify-center overflow-hidden">
                {journal.cover_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://www.acarindex.com/${journal.cover_path}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <h1 className="font-serif text-2xl sm:text-[1.75rem] font-bold text-foreground leading-snug">
                  {title}
                </h1>
                <JournalMetadataGrid journal={journal} />
              </div>
            </header>

            <JournalNav segment={resolved.journalSegment} active={resolved.subPage} />

            <div className="border-b border-border/80 mb-6 md:mb-8" />

            {resolved.subPage === 'home' && (
              <JournalHome journal={journal} journalId={parsed.journalId} segment={resolved.journalSegment} />
            )}
            {resolved.subPage === 'arsiv' && (
              <JournalArsiv journalId={parsed.journalId} segment={resolved.journalSegment} />
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
          </>
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
    <nav className="flex flex-wrap gap-1.5 mb-4 min-w-0" aria-label="Dergi menüsü">
      {links.map(({ label, href, key }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'text-sm px-3 py-2 min-h-[36px] inline-flex items-center rounded-md transition-colors no-underline',
            linkFocusClass,
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

  const arsivHref = `/journals/${segment}/arsiv`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 lg:gap-10 min-w-0">
      <div className="min-w-0 space-y-8 md:space-y-10">
        {issues.length > 0 && (
          <section className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="text-lg font-serif font-semibold text-foreground">Sayılar</h2>
              <Link
                href={arsivHref}
                className={cn('text-sm text-primary hover:text-accent no-underline inline-flex items-center gap-0.5', linkFocusClass)}
              >
                Tüm arşiv
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-border/80 min-w-0">
              {issues.slice(0, 8).map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/journals/${segment}/sayi/${issue.id}`}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 py-3 text-sm no-underline group',
                      linkFocusClass,
                    )}
                  >
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors min-w-0 line-clamp-2">
                      {issue.issue_label ?? (issue.year ? String(issue.year) : 'Sayı')}
                    </span>
                    {issue.year && issue.issue_label && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {issue.year}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="min-w-0">
          <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Son makaleler</h2>
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Bu dergide henüz listelenecek makale bulunmuyor.
            </p>
          ) : (
            <ul className="divide-y divide-border/80 min-w-0">
              {articles.map((a) => (
                <ArticleRow key={a.id} article={a} />
              ))}
            </ul>
          )}
          {articles.length > 0 && (
            <Link
              href={arsivHref}
              className={cn(
                'inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-accent mt-4 no-underline',
                linkFocusClass,
              )}
            >
              Tüm sayıları gör
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </section>

        {journal.description?.trim() && (
          <section className="min-w-0">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-3">Dergi hakkında</h2>
            <p className="text-sm sm:text-base leading-relaxed text-foreground/85 max-w-3xl">
              {journal.description.trim()}
            </p>
          </section>
        )}
      </div>

      <aside className="space-y-5 min-w-0 lg:pt-0">
        {issues[0] && (
          <div className="rounded-lg border border-border/80 p-4 bg-muted/20 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-2">Son sayı</h3>
            <Link
              href={`/journals/${segment}/sayi/${issues[0].id}`}
              className={cn(
                'text-sm font-medium text-primary hover:text-accent leading-snug line-clamp-3 no-underline',
                linkFocusClass,
              )}
            >
              {issues[0].issue_label ?? (issues[0].year ? String(issues[0].year) : 'Son sayı')}
            </Link>
          </div>
        )}

        <div className="rounded-lg border border-border/80 p-4 bg-muted/20 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-3">Hızlı bağlantılar</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href={arsivHref} className={cn('text-primary hover:text-accent no-underline', linkFocusClass)}>
                Arşiv ve sayılar
              </Link>
            </li>
            <li>
              <Link
                href={`/journals/${segment}/amac-kapsam`}
                className={cn('text-primary hover:text-accent no-underline', linkFocusClass)}
              >
                Amaç ve kapsam
              </Link>
            </li>
            <li>
              <Link
                href={`/journals/${segment}/iletisim`}
                className={cn('text-primary hover:text-accent no-underline', linkFocusClass)}
              >
                İletişim
              </Link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

async function JournalArsiv({ journalId, segment }: { journalId: number; segment: string }) {
  const issues = await getIssues(journalId)

  const byYear = issues.reduce<Record<number, Issue[]>>((acc, issue) => {
    const year = issue.year ?? 0
    if (!acc[year]) acc[year] = []
    acc[year].push(issue)
    return acc
  }, {})

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <section className="min-w-0">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Arşiv</h2>
      {years.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Bu dergi için arşiv kaydı bulunmuyor.
        </p>
      ) : (
        <div className="space-y-6 min-w-0">
          {years.map((year) => (
            <div key={year} className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-2 pb-1 border-b border-border/80">
                {year || 'Tarihsiz'}
              </h3>
              <ul className="divide-y divide-border/80 min-w-0">
                {byYear[year].map((issue) => (
                  <li key={issue.id}>
                    <Link
                      href={`/journals/${segment}/sayi/${issue.id}`}
                      className={cn(
                        'block py-2.5 text-sm font-medium text-primary hover:text-accent no-underline',
                        linkFocusClass,
                      )}
                    >
                      {issue.issue_label ?? (year ? String(year) : 'Sayı')}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function formatIssueBreadcrumbLabel(issue: Issue): string {
  const raw = issue.issue_number ?? issue.issue_label ?? (issue.year ? String(issue.year) : 'Sayı')
  return raw.length > 40 ? `${raw.slice(0, 37).trimEnd()}…` : raw
}

function buildIssueHeadingSuffix(issue: Issue): string | null {
  if (issue.issue_number?.trim()) return issue.issue_number.trim()
  const parts: string[] = []
  if (issue.volume?.trim()) parts.push(`Cilt ${issue.volume.trim()}`)
  if (issue.year) parts.push(String(issue.year))
  if (parts.length > 0) return parts.join(', ')
  if (issue.issue_label?.trim()) return issue.issue_label.trim()
  return issue.year ? String(issue.year) : null
}

async function JournalSayi({
  journal,
  issueId,
  segment,
}: {
  journal: Journal
  issueId: number
  segment: string
}) {
  const issue = await getIssue(issueId)
  const articles = await getIssueArticles(issueId)

  if (!issue) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        İstenen sayı bulunamadı.
      </p>
    )
  }

  const issueRow = issue
  const journalTitle = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const journalHref = `/journals/${segment}`
  const arsivHref = `${journalHref}/arsiv`
  const issueSuffix = buildIssueHeadingSuffix(issueRow)
  const breadcrumbIssueLabel = formatIssueBreadcrumbLabel(issueRow)
  const articleCount = articles.length

  const metadataItems = [
    issueRow.year && { label: 'Yayın yılı', value: String(issueRow.year) },
    issueRow.volume?.trim() && { label: 'Cilt', value: issueRow.volume.trim() },
    issueRow.issue_number?.trim() && { label: 'Sayı', value: issueRow.issue_number.trim() },
    articleCount > 0 && {
      label: 'Makale sayısı',
      value: articleCount.toLocaleString('tr-TR'),
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <div className="min-w-0">
      <Breadcrumb className="mb-5 md:mb-6 min-w-0" aria-label="Breadcrumb">
        <BreadcrumbList className="min-w-0 flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className={linkFocusClass}>Ana Sayfa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/journals" className={linkFocusClass}>Dergiler</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 max-w-[38%] sm:max-w-xs">
            <BreadcrumbLink
              href={journalHref}
              className={cn('line-clamp-1', linkFocusClass)}
              title={journalTitle}
            >
              {journalTitle}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 max-w-[38%] sm:max-w-xs">
            <BreadcrumbPage className="line-clamp-1" title={breadcrumbIssueLabel}>
              {breadcrumbIssueLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mb-6 md:mb-8 space-y-4 min-w-0">
        <div className="space-y-2 min-w-0">
          <h1 className="font-serif text-2xl sm:text-[1.75rem] font-bold text-foreground leading-snug">
            <Link
              href={journalHref}
              className={cn(
                'text-primary hover:text-accent transition-colors no-underline',
                linkFocusClass,
              )}
            >
              {journalTitle}
            </Link>
            {issueSuffix && (
              <>
                <span className="text-muted-foreground font-normal"> — </span>
                <span className="text-foreground">{issueSuffix}</span>
              </>
            )}
          </h1>
        </div>

        {metadataItems.length > 0 && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
            {metadataItems.map((item) => (
              <MetadataItem key={item.label} label={item.label}>
                <span className="tabular-nums">{item.value}</span>
              </MetadataItem>
            ))}
          </dl>
        )}
      </header>

      <section className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          <h2 className="text-lg font-serif font-semibold text-foreground">
            Bu sayıdaki makaleler
          </h2>
          {articleCount > 0 && (
            <p className="text-sm text-muted-foreground tabular-nums shrink-0">
              {articleCount.toLocaleString('tr-TR')} makale
            </p>
          )}
        </div>

        {articleCount === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            Bu sayıda listelenecek makale bulunmuyor.
          </p>
        ) : (
          <ul className="divide-y divide-border/80 min-w-0">
            {articles.map((a) => (
              <IssueArticleRow key={a.id} article={a} />
            ))}
          </ul>
        )}
      </section>

      <Link
        href={arsivHref}
        className={cn(
          'inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-accent mt-6 no-underline',
          linkFocusClass,
        )}
      >
        Arşive dön
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  )
}

function CmsSection({ title, html }: { title: string; html: string | null | undefined }) {
  if (!html?.trim()) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        Bu bölüm için içerik henüz eklenmemiş.
      </p>
    )
  }
  return (
    <section className="min-w-0">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">{title}</h2>
      <div
        className="prose prose-sm max-w-3xl text-foreground/90"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}

function IssueArticleRow({ article }: { article: Partial<Article> }) {
  const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
  const href = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const authors = formatAuthors(article.authors_raw)
  const pages = formatPageRange(article.page_start, article.page_end)

  return (
    <li className="group py-4 first:pt-0 last:pb-0 min-w-0">
      <Link href={href} className={cn('block no-underline', linkFocusClass)}>
        <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-3">
          {title}
        </h3>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        {(authors || pages) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-[0.8125rem] text-foreground/70">
            {authors && <span className="min-w-0">{authors}</span>}
            {authors && pages && (
              <span className="text-muted-foreground" aria-hidden>·</span>
            )}
            {pages && (
              <span className="tabular-nums shrink-0 text-muted-foreground">ss. {pages}</span>
            )}
          </div>
        )}
        <Link
          href={`/pdfs/${article.id}`}
          aria-label={`${title} — tam metin PDF`}
          className={cn(
            'inline-flex items-center gap-1.5 shrink-0 rounded-md border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors no-underline',
            linkFocusClass,
          )}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          PDF
        </Link>
      </div>
    </li>
  )
}

function ArticleRow({ article }: { article: Partial<Article> }) {
  const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
  const href = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const authors = formatAuthors(article.authors_raw)
  const pages = formatPageRange(article.page_start, article.page_end)

  return (
    <li className="group py-4 first:pt-0 last:pb-0 min-w-0">
      <Link
        href={href}
        className={cn('block no-underline', linkFocusClass)}
      >
        <span className="text-base font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-3">
          {title}
        </span>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
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
            {pages && (
              <>
                <span className="text-muted-foreground" aria-hidden>·</span>
                <span className="tabular-nums shrink-0 text-muted-foreground">ss. {pages}</span>
              </>
            )}
          </div>
        )}
        <Link
          href={`/pdfs/${article.id}`}
          aria-label={`${title} — tam metin PDF`}
          className={cn(
            'inline-flex items-center gap-1.5 shrink-0 rounded-md border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors no-underline',
            linkFocusClass,
          )}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          PDF
        </Link>
      </div>
    </li>
  )
}
