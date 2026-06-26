import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import * as journalData from '@/lib/data/journals'
import { parseJournalSegment, parseIssueIdSegment } from '@/lib/urls/journal'
import { cn, buttonVariants } from '@/lib/utils'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { BookOpen, FileText, ChevronRight, ExternalLink } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  buildIssueMetadataDescription,
  buildIssueMetadataTitle,
} from '@/lib/journals/issue-citation'
import { buildIssuePageJsonLd } from '@/lib/seo/issue-jsonld'
import { buildArchivePageJsonLd } from '@/lib/seo/archive-jsonld'
import {
  buildArchiveIssueHref,
  buildArchiveIssueLabel,
  groupArchiveIssues,
} from '@/lib/journals/archive'
import type { Journal, Issue, Article } from '@/types/database'
import type { ReactNode } from 'react'
import { cache } from 'react'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { getServerSession } from '@/lib/auth/session'
import { recordRecentView } from '@/lib/user-panel/recent-views'
import { isJournalFollowed } from '@/lib/user-panel/follows'
import { FollowJournalButton } from '@/components/user-panel/FollowJournalButton'
import { buildLoginHref } from '@/lib/user-panel/login-redirect'

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
  if (sub === 'sayi') {
    if (!rest[0]) return null
    const issueId = parseIssueIdSegment(rest[0])
    if (issueId === null) return null
    return { journalSegment, subPage: 'sayi', issueId }
  }
  return null
}

const linkFocusClass =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

// ─── Veri ────────────────────────────────────────────────────────────────────

async function getJournal(journalId: number) {
  return journalData.getPublishedJournalById(journalId)
}

async function getIssuesUncached(journalId: number) {
  return journalData.listPublishedIssuesForJournal(journalId)
}

const getIssues = cache(getIssuesUncached)

async function getIssueArticlesUncached(issueId: number) {
  return journalData.listArticlesForIssue(issueId)
}

const getIssueArticles = cache(getIssueArticlesUncached)

async function countIssueArticlesUncached(issueId: number): Promise<number> {
  return journalData.countArticlesForIssue(issueId)
}

const countIssueArticles = cache(countIssueArticlesUncached)

async function getIssueUncached(issueId: number) {
  return journalData.getPublishedIssueById(issueId)
}

const getIssue = cache(getIssueUncached)

async function requireJournalIssue(journalId: number, issueId: number): Promise<Issue> {
  const issue = await getIssue(issueId)
  if (!issue || issue.journal_id !== journalId) {
    notFound()
  }
  return issue
}

async function getLatestArticles(journalId: number, limit = 10) {
  return journalData.listLatestArticlesForJournal(journalId, limit)
}

// ─── Metadata ────────────────────────────────────────────────────────────────

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
    const issue = await requireJournalIssue(parsed.journalId, resolved.issueId)

    const articleCount = await countIssueArticles(resolved.issueId)
    const pageTitle = buildIssueMetadataTitle(journalTitle, issue)
    const description = buildIssueMetadataDescription(journalTitle, issue, articleCount)

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

  if (resolved.subPage === 'arsiv') {
    const archiveTitle = `${journalTitle} Arşivi`
    const archiveDescription = `${journalTitle} dergisinin yayımlanmış sayılarını yıllara göre inceleyin.`

    return {
      title: archiveTitle,
      description: archiveDescription,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: archiveTitle,
        description: archiveDescription,
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

  const showJournalPeriodicalJsonLd =
    resolved.subPage === 'home' || resolved.subPage === 'arsiv'

  const authEnabled = isUserAuthEnabled()
  const session = authEnabled ? await getServerSession() : null
  const isLoggedIn = session?.user.status === 'active'
  const journalPublicPath = `/journals/${resolved.journalSegment}`
  const loginHref = buildLoginHref(journalPublicPath)

  if (isLoggedIn && session) {
    await recordRecentView(session.user.id, 'journal', parsed.journalId)
  }

  const journalFollowing =
    isLoggedIn && session
      ? await isJournalFollowed(session.user.id, parsed.journalId)
      : false

  return (
    <>
      {showJournalPeriodicalJsonLd && <JsonLd data={schema} />}
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
                {authEnabled && (
                  <FollowJournalButton
                    journalId={parsed.journalId}
                    initialFollowing={journalFollowing}
                    loginHref={loginHref}
                  />
                )}
                <JournalMetadataGrid journal={journal} />
              </div>
            </header>

            <JournalNav segment={resolved.journalSegment} active={resolved.subPage} />

            <div className="border-b border-border/80 mb-6 md:mb-8" />

            {resolved.subPage === 'home' && (
              <JournalHome journal={journal} journalId={parsed.journalId} segment={resolved.journalSegment} />
            )}
            {resolved.subPage === 'arsiv' && (
              <JournalArsiv journal={journal} segment={resolved.journalSegment} />
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
              ? 'bg-brand-primary/10 text-brand-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-brand-primary/[0.035]',
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
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-10 min-w-0">
      <div className="min-w-0 space-y-8 md:space-y-10 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
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
            <p className="text-sm sm:text-base leading-relaxed text-foreground/85 max-w-3xl text-justify hyphens-auto">
              {journal.description.trim()}
            </p>
          </section>
        )}
      </div>

      <aside className="space-y-5 min-w-0 lg:pt-0">
        {issues[0] && (
          <div className="aside-panel min-w-0">
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

        <div className="aside-panel min-w-0">
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

async function JournalArsiv({
  journal,
  segment,
}: {
  journal: Journal
  segment: string
}) {
  const issues = await getIssues(journal.id)
  const grouped = groupArchiveIssues(issues)
  const journalTitle = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const archiveTitle = `${journalTitle} Arşivi`
  const archiveDescription = `${journalTitle} dergisinin yayımlanmış sayılarını yıllara göre inceleyin.`
  const archiveJsonLd = buildArchivePageJsonLd({
    canonicalBase,
    journalSegment: segment,
    journal,
    issues,
    pageTitle: archiveTitle,
    description: archiveDescription,
  })

  return (
    <>
      <JsonLd data={archiveJsonLd} />
      <section className="min-w-0 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
        <header className="mb-6 md:mb-8 space-y-2 min-w-0">
          <h2 className="text-lg font-serif font-semibold text-foreground">Arşiv</h2>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {journalTitle} dergisinin yayımlanmış sayılarını yıllara göre inceleyin.
          </p>
        </header>

        {grouped.totalIssues === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            Bu dergi için henüz arşivlenmiş sayı bulunmuyor.
          </p>
        ) : (
          <div className="space-y-8 min-w-0">
            {grouped.groups.map((group) => (
              <div key={group.yearKey} className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/80">
                  {group.heading}
                </h3>
                <ul className="catalog-list-container divide-y divide-border/60 min-w-0">
                  {group.issues.map((issue) => (
                    <li key={issue.id}>
                      <Link
                        href={buildArchiveIssueHref(segment, issue.id)}
                        className={cn(
                          'flex items-center gap-2 min-w-0 px-3 py-3 sm:px-4 text-sm font-medium text-foreground hover:text-primary hover:bg-brand-primary/[0.035] transition-colors no-underline',
                          linkFocusClass,
                        )}
                      >
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 line-clamp-2 leading-snug">
                          {buildArchiveIssueLabel(issue)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
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
  const issue = await requireJournalIssue(journal.id, issueId)
  const articles = await getIssueArticles(issueId)

  const issueRow = issue
  const journalTitle = journal.title_tr ?? journal.title_en ?? 'Dergi'
  const journalHref = `/journals/${segment}`
  const arsivHref = `${journalHref}/arsiv`
  const issueSuffix = buildIssueHeadingSuffix(issueRow)
  const breadcrumbIssueLabel = formatIssueBreadcrumbLabel(issueRow)
  const articleCount = articles.length
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const pageTitle = buildIssueMetadataTitle(journalTitle, issueRow)
  const pageDescription = buildIssueMetadataDescription(journalTitle, issueRow, articleCount)
  const issueJsonLd = buildIssuePageJsonLd({
    canonicalBase,
    journalSegment: segment,
    journal,
    issue: issueRow,
    articles,
    pageTitle,
    description: pageDescription,
  })

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
    <>
      <JsonLd data={issueJsonLd} />
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

      <section className="min-w-0 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
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
    </>
  )
}

function CmsSection({ title, html }: { title: string; html: string | null | undefined }) {
  if (!html?.trim()) {
    return (
      <div className="catalog-empty-panel">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">Bu bölüm için içerik henüz eklenmemiş.</p>
      </div>
    )
  }
  return (
    <section className="min-w-0 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">{title}</h2>
      <div
        className="prose prose-sm max-w-3xl text-foreground/90 text-justify hyphens-auto"
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
          className={cn('catalog-pdf-badge', linkFocusClass)}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
          className={cn('catalog-pdf-badge', linkFocusClass)}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          PDF
        </Link>
      </div>
    </li>
  )
}
