import { notFound, redirect } from 'next/navigation'
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
  formatIssueVolumeIssueLabel,
  getIssueLabelStrings,
  parseIssueCitationParts,
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
import { JournalSearchForm } from '@/components/journals/JournalSearchForm'
import { buildLoginHref } from '@/lib/user-panel/login-redirect'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import type { SiteLocale } from '@/lib/i18n/locale'
import { buildJournalCatalogPath } from '@/lib/i18n/slugs'
import { shouldRedirectEnJournalToTr } from '@/lib/i18n/en-route-guard'
import { pickLocalizedArticleDisplayTitle, pickLocalizedJournalDescription } from '@/lib/i18n/pick-localized-text'
import { buildJournalMetadataAlternates, pickLocalizedTitle } from '@/lib/seo/hreflang'
import { getUiMessages } from '@/lib/i18n/ui-messages'
import type { UiMessages } from '@/lib/i18n/ui-messages'
import { withLocalePath } from '@/lib/i18n/locale'

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

  const locale = await getRequestLocale()
  const ui = getUiMessages(locale)
  const journalTitle = pickLocalizedTitle(journal.title_tr, journal.title_en, locale) || (locale === 'en' ? 'Journal' : 'Dergi')
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const subPath =
    resolved.subPage === 'home'
      ? ''
      : `/${journalPath.slice(1).join('/')}`
  const journalRow = {
    id: parsed.journalId,
    slug: journal.slug,
    slugTr: journal.slug_tr,
    slugEn: journal.slug_en,
    titleTr: journal.title_tr,
    titleEn: journal.title_en,
    description: journal.description,
    about: journal.about,
    aimAndScope: journal.aim_and_scope,
    hasEnContent: journal.has_en_content,
  }
  const canonicalPath = buildJournalCanonicalPath(resolved, journalPath)
  const hreflangAlternates = buildJournalMetadataAlternates(
    canonicalBase,
    journalRow,
    locale,
    subPath,
  )

  if (resolved.subPage === 'sayi' && resolved.issueId) {
    const issue = await requireJournalIssue(parsed.journalId, resolved.issueId)

    const articleCount = await countIssueArticles(resolved.issueId)
    const pageTitle = buildIssueMetadataTitle(journalTitle, issue, locale)
    const description = buildIssueMetadataDescription(journalTitle, issue, articleCount, locale)

    return {
      title: pageTitle,
      description,
      alternates: hreflangAlternates,
      openGraph: {
        title: pageTitle,
        description,
        url: canonicalPath,
      },
    }
  }

  if (resolved.subPage === 'arsiv') {
    const archiveTitle = ui.journalPage.archivePageTitle.replace('{title}', journalTitle)
    const archiveDescription = ui.journalPage.archiveIntro.replace('{title}', journalTitle)

    return {
      title: archiveTitle,
      description: archiveDescription,
      alternates: hreflangAlternates,
      openGraph: {
        title: archiveTitle,
        description: archiveDescription,
        url: canonicalPath,
      },
    }
  }

  const journalDescription = pickLocalizedJournalDescription(journal.description, locale)

  return {
    title: journalTitle,
    description: journalDescription?.slice(0, 160),
    alternates: hreflangAlternates,
  }
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function formatAuthors(raw: string | null | undefined, max = 3): string {
  if (!raw) return ''
  return parseAuthorNames(raw, max).join(', ')
}

function parseAuthorNames(raw: string | null | undefined, max = 4): string[] {
  if (!raw) return []
  return [...new Set(raw.split(/[,;]+/).map((a) => a.trim()).filter(Boolean))].slice(0, max)
}

function hasCmsContent(html: string | null | undefined): boolean {
  if (!html?.trim()) return false
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0
}

function AuthorNameLinks({
  authorsRaw,
  max = 4,
  className,
  lp,
}: {
  authorsRaw: string | null | undefined
  max?: number
  className?: string
  lp: (path: string) => string
}) {
  const names = parseAuthorNames(authorsRaw, max)
  if (names.length === 0) return null

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0', className)}>
      {names.map((name, index) => (
        <span key={`${name}-${index}`} className="inline-flex items-center gap-1 min-w-0">
          <Link
            href={lp(`/search?q=${encodeURIComponent(name)}&type=article&area=author`)}
            className={cn('type-meta-link text-primary hover:text-accent no-underline', linkFocusClass)}
          >
            {name}
          </Link>
          {index < names.length - 1 && (
            <span className="text-muted-foreground" aria-hidden>,</span>
          )}
        </span>
      ))}
    </span>
  )
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
      <dt className="type-section-label">{label}</dt>
      <dd className="type-meta-value mt-1 min-w-0">{children}</dd>
    </div>
  )
}

function JournalMetadataGrid({ journal, ui }: { journal: Journal; ui: UiMessages }) {
  const website = journal.legacy_link?.trim()
  const hasWebsite = website && /^https?:\/\//i.test(website)

  const items = [
    journal.publisher && { label: ui.journalPage.publisher, value: journal.publisher },
    journal.issn && { label: 'ISSN', value: journal.issn },
    journal.eissn && { label: 'e-ISSN', value: journal.eissn },
    journal.publish_language && { label: ui.journalPage.publishLanguage, value: journal.publish_language },
    journal.frequency && { label: ui.journalPage.frequency, value: journal.frequency },
    journal.start_year && { label: ui.journalPage.startYear, value: journal.start_year },
    journal.subject_category && { label: ui.journalPage.subjectCategory, value: journal.subject_category },
    hasWebsite && {
      label: ui.journalPage.website,
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

  const locale = await getRequestLocale()
  const ui = getUiMessages(locale)
  const lp = (path: string) => withLocalePath(path, locale)
  if (
    shouldRedirectEnJournalToTr(locale, {
      has_en_content: journal.has_en_content,
      titleEn: journal.title_en,
      titleTr: journal.title_tr,
      description: journal.description,
      about: journal.about,
      aimAndScope: journal.aim_and_scope,
    })
  ) {
    const sub =
      resolved.subPage === 'home'
        ? ''
        : `/${journalPath.slice(1).join('/')}`
    redirect(
      `${buildJournalCatalogPath(
        {
          id: parsed.journalId,
          slug: journal.slug,
          slugTr: journal.slug_tr,
          slugEn: journal.slug_en,
        },
        'tr',
      )}${sub}`,
    )
  }

  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const journalBase = `${canonicalBase}/journals/${resolved.journalSegment}`
  const title = pickLocalizedTitle(journal.title_tr, journal.title_en, locale)
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
  const journalPublicPath = lp(`/journals/${resolved.journalSegment}`)
  const loginHref = buildLoginHref(`/journals/${resolved.journalSegment}`)

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
            <JournalNav segment={resolved.journalSegment} active={resolved.subPage} journal={journal} ui={ui} lp={lp} />
            <div className="border-b border-border/80 mb-6 md:mb-8" />
            <JournalSayi
              journal={journal}
              issueId={resolved.issueId}
              segment={resolved.journalSegment}
              locale={locale}
              ui={ui}
              lp={lp}
            />
          </>
        ) : (
          <>
            <Breadcrumb className="mb-5 md:mb-6 min-w-0" aria-label="Breadcrumb">
              <BreadcrumbList className="min-w-0">
                <BreadcrumbItem>
                  <BreadcrumbLink href={lp('/')} className={linkFocusClass}>{ui.article.home}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={lp('/journals')} className={linkFocusClass}>{ui.nav.journals}</BreadcrumbLink>
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
              <div className="shrink-0 w-28 h-40 sm:w-36 sm:h-[13.5rem] md:w-40 md:h-56 bg-secondary rounded-lg border border-border/80 flex items-center justify-center overflow-hidden shadow-sm">
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
                <h1 className="type-page-heading leading-snug">
                  {title}
                </h1>
                {authEnabled && (
                  <FollowJournalButton
                    journalId={parsed.journalId}
                    initialFollowing={journalFollowing}
                    loginHref={loginHref}
                  />
                )}
                <JournalMetadataGrid journal={journal} ui={ui} />
              </div>
            </header>

            <JournalNav segment={resolved.journalSegment} active={resolved.subPage} journal={journal} ui={ui} lp={lp} />

            <div className="border-b border-border/80 mb-6 md:mb-8" />

            {resolved.subPage === 'home' && (
              <JournalHome
                journal={journal}
                journalId={parsed.journalId}
                segment={resolved.journalSegment}
                locale={locale}
                ui={ui}
                lp={lp}
              />
            )}
            {resolved.subPage === 'arsiv' && (
              <JournalArsiv journal={journal} segment={resolved.journalSegment} locale={locale} ui={ui} lp={lp} />
            )}
            {resolved.subPage === 'amac-kapsam' &&
              (hasCmsContent(journal.aim_and_scope) ? (
                <CmsSection title={ui.journalPage.aimScope} html={journal.aim_and_scope} ui={ui} />
              ) : (
                redirect(lp(`/journals/${resolved.journalSegment}`))
              ))}
            {resolved.subPage === 'editor-kurulu' &&
              (hasCmsContent(journal.editorial_board) ? (
                <CmsSection title={ui.journalPage.editorialBoard} html={journal.editorial_board} ui={ui} />
              ) : (
                redirect(lp(`/journals/${resolved.journalSegment}`))
              ))}
            {resolved.subPage === 'yazim-kurallari' &&
              (hasCmsContent(journal.writing_rules) ? (
                <CmsSection title={ui.journalPage.writingRules} html={journal.writing_rules} ui={ui} />
              ) : (
                redirect(lp(`/journals/${resolved.journalSegment}`))
              ))}
            {resolved.subPage === 'iletisim' &&
              (hasCmsContent(journal.contact_text) ? (
                <CmsSection title={ui.journalPage.contact} html={journal.contact_text} ui={ui} />
              ) : (
                redirect(lp(`/journals/${resolved.journalSegment}`))
              ))}
          </>
        )}
      </div>
    </>
  )
}

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function JournalNav({
  segment,
  active,
  journal,
  ui,
  lp,
}: {
  segment: string
  active: SubPage
  journal: Journal
  ui: UiMessages
  lp: (path: string) => string
}) {
  const base = lp(`/journals/${segment}`)
  const allLinks: { label: string; href: string; key: SubPage; visible: boolean }[] = [
    { label: ui.journalPage.home, href: base, key: 'home', visible: true },
    { label: ui.journalPage.archive, href: `${base}/arsiv`, key: 'arsiv', visible: true },
    {
      label: ui.journalPage.aimScope,
      href: `${base}/amac-kapsam`,
      key: 'amac-kapsam',
      visible: hasCmsContent(journal.aim_and_scope),
    },
    {
      label: ui.journalPage.editorialBoard,
      href: `${base}/editor-kurulu`,
      key: 'editor-kurulu',
      visible: hasCmsContent(journal.editorial_board),
    },
    {
      label: ui.journalPage.writingRules,
      href: `${base}/yazim-kurallari`,
      key: 'yazim-kurallari',
      visible: hasCmsContent(journal.writing_rules),
    },
    {
      label: ui.journalPage.contact,
      href: `${base}/iletisim`,
      key: 'iletisim',
      visible: hasCmsContent(journal.contact_text),
    },
  ]
  const links = allLinks.filter((link) => link.visible)

  return (
    <nav className="flex flex-wrap gap-1.5 mb-4 min-w-0" aria-label={ui.journalPage.journalMenu}>
      {links.map(({ label, href, key }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'type-filter-option px-3 py-2 min-h-[36px] inline-flex items-center rounded-md transition-colors no-underline',
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
  locale,
  ui,
  lp,
}: {
  journal: Journal
  journalId: number
  segment: string
  locale: SiteLocale
  ui: UiMessages
  lp: (path: string) => string
}) {
  const [issues, articles] = await Promise.all([
    getIssues(journalId),
    getLatestArticles(journalId, 10),
  ])

  const arsivHref = lp(`/journals/${segment}/arsiv`)
  const aboutText = pickLocalizedJournalDescription(journal.description, locale)
  const quickLinks = [
    { label: ui.journalPage.archiveAndIssues, href: arsivHref, visible: true },
    {
      label: ui.journalPage.aimScope,
      href: lp(`/journals/${segment}/amac-kapsam`),
      visible: hasCmsContent(journal.aim_and_scope),
    },
    {
      label: ui.journalPage.contact,
      href: lp(`/journals/${segment}/iletisim`),
      visible: hasCmsContent(journal.contact_text),
    },
  ].filter((link) => link.visible)

  return (
    <div className="layout-journal-detail min-w-0">
      <div className="min-w-0 space-y-8 md:space-y-10 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
        <section className="min-w-0">
          <h2 className="type-section-title mb-4">{ui.journalPage.recentArticles}</h2>
          {articles.length === 0 ? (
            <p className="type-card-meta py-4">
              {ui.journalPage.noRecentArticles}
            </p>
          ) : (
            <ul className="divide-y divide-border/80 min-w-0">
              {articles.map((a) => (
                <ArticleRow key={a.id} article={a} locale={locale} lp={lp} ui={ui} />
              ))}
            </ul>
          )}
          {articles.length > 0 && (
            <Link
              href={arsivHref}
              className={cn(
                'type-sidebar-link inline-flex items-center gap-1 text-primary hover:text-accent mt-4 no-underline',
                linkFocusClass,
              )}
            >
              {ui.journalPage.viewAllIssues}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </section>

        {issues.length > 0 && (
          <section className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="type-section-title">{ui.journalPage.issues}</h2>
              <Link
                href={arsivHref}
                className={cn('type-sidebar-link text-primary hover:text-accent no-underline inline-flex items-center gap-0.5', linkFocusClass)}
              >
                {ui.journalPage.allArchive}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-border/80 min-w-0">
              {issues.slice(0, 8).map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={lp(`/journals/${segment}/sayi/${issue.id}`)}
                    className={cn(
                      'type-filter-option flex flex-wrap items-center justify-between gap-2 py-3 no-underline group',
                      linkFocusClass,
                    )}
                  >
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors min-w-0 line-clamp-2">
                      {issue.issue_label ?? (issue.year ? String(issue.year) : ui.journalPage.issueFallback)}
                    </span>
                    {issue.year && issue.issue_label && (
                      <span className="type-card-meta tabular-nums shrink-0">
                        {issue.year}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {aboutText && (
          <section className="min-w-0">
            <h2 className="type-section-title mb-3">{ui.journalPage.aboutJournal}</h2>
            <p className="type-reading-body max-w-3xl">
              {aboutText}
            </p>
          </section>
        )}
      </div>

      <aside className="layout-sidebar-column space-y-5 min-w-0 lg:pt-0">
        <div className="aside-panel min-w-0">
          <h3 className="type-sidebar-heading mb-3">{ui.journalPage.searchInJournal}</h3>
          <JournalSearchForm journalId={journalId} locale={locale} ui={ui} />
        </div>

        {issues[0] && (
          <div className="aside-panel min-w-0">
            <h3 className="type-sidebar-heading mb-2">{ui.journalPage.latestIssue}</h3>
            <Link
              href={lp(`/journals/${segment}/sayi/${issues[0].id}`)}
              className={cn(
                'type-sidebar-link text-primary hover:text-accent line-clamp-3 no-underline',
                linkFocusClass,
              )}
            >
              {issues[0].issue_label ?? (issues[0].year ? String(issues[0].year) : ui.journalPage.latestIssue)}
            </Link>
          </div>
        )}

        {quickLinks.length > 0 && (
          <div className="aside-panel min-w-0">
            <h3 className="type-sidebar-heading mb-3">{ui.journalPage.quickLinks}</h3>
            <ul className="space-y-2.5 type-sidebar-link">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={cn('text-primary hover:text-accent no-underline', linkFocusClass)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

async function JournalArsiv({
  journal,
  segment,
  locale,
  ui,
  lp,
}: {
  journal: Journal
  segment: string
  locale: SiteLocale
  ui: UiMessages
  lp: (path: string) => string
}) {
  const issues = await getIssues(journal.id)
  const grouped = groupArchiveIssues(issues, locale)
  const journalTitle = pickLocalizedTitle(journal.title_tr, journal.title_en, locale) || (locale === 'en' ? 'Journal' : 'Dergi')
  const archiveTitle = ui.journalPage.archivePageTitle.replace('{title}', journalTitle)
  const archiveDescription = ui.journalPage.archiveIntro.replace('{title}', journalTitle)
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const archiveJsonLd = buildArchivePageJsonLd({
    canonicalBase,
    journalSegment: segment,
    journal,
    issues,
    pageTitle: archiveTitle,
    description: archiveDescription,
    locale,
  })

  return (
    <>
      <JsonLd data={archiveJsonLd} />
      <section className="min-w-0 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
        <header className="mb-6 md:mb-8 space-y-2 min-w-0">
          <h2 className="type-section-title">{ui.journalPage.archive}</h2>
          <p className="type-section-desc max-w-3xl">
            {archiveDescription}
          </p>
        </header>

        {grouped.totalIssues === 0 ? (
          <p className="type-card-meta py-6">
            {ui.journalPage.noArchivedIssues}
          </p>
        ) : (
          <div className="space-y-8 min-w-0">
            {grouped.groups.map((group) => (
              <div key={group.yearKey} className="min-w-0">
                <h3 className="type-filter-heading mb-3 pb-2 border-b border-border/80 text-foreground">
                  {group.heading}
                </h3>
                <ul className="catalog-list-container divide-y divide-border/60 min-w-0">
                  {group.issues.map((issue) => (
                    <li key={issue.id}>
                      <Link
                        href={lp(buildArchiveIssueHref(segment, issue.id))}
                        className={cn(
                          'type-filter-option flex items-center gap-2 min-w-0 px-3 py-3 sm:px-4 font-medium text-foreground hover:text-primary hover:bg-brand-primary/[0.035] transition-colors no-underline',
                          linkFocusClass,
                        )}
                      >
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 line-clamp-2 leading-snug">
                          {buildArchiveIssueLabel(issue, locale)}
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

function formatIssueBreadcrumbLabel(issue: Issue, fallback: string): string {
  const raw = issue.issue_number ?? issue.issue_label ?? (issue.year ? String(issue.year) : fallback)
  return raw.length > 40 ? `${raw.slice(0, 37).trimEnd()}…` : raw
}

function buildIssueHeadingSuffix(issue: Issue, locale: SiteLocale): string | null {
  const labels = getIssueLabelStrings(locale)
  const { volumeLabel, issueNumLabel, year } = parseIssueCitationParts(issue)
  const structured = formatIssueVolumeIssueLabel(volumeLabel, issueNumLabel, labels)
  if (structured) return structured

  const parts: string[] = []
  if (issue.volume?.trim()) parts.push(`${labels.volume} ${issue.volume.trim()}`)
  if (issue.year) parts.push(String(issue.year))
  if (parts.length > 0) return parts.join(', ')
  if (issue.issue_label?.trim()) return issue.issue_label.trim()
  return issue.year ? String(issue.year) : null
}

async function JournalSayi({
  journal,
  issueId,
  segment,
  locale,
  ui,
  lp,
}: {
  journal: Journal
  issueId: number
  segment: string
  locale: SiteLocale
  ui: UiMessages
  lp: (path: string) => string
}) {
  const issue = await requireJournalIssue(journal.id, issueId)
  const articles = await getIssueArticles(issueId)
  const numberLocale = locale === 'en' ? 'en-US' : 'tr-TR'

  const issueRow = issue
  const journalTitle = pickLocalizedTitle(journal.title_tr, journal.title_en, locale) || (locale === 'en' ? 'Journal' : 'Dergi')
  const journalHref = lp(`/journals/${segment}`)
  const arsivHref = lp(`/journals/${segment}/arsiv`)
  const issueSuffix = buildIssueHeadingSuffix(issueRow, locale)
  const breadcrumbIssueLabel = formatIssueBreadcrumbLabel(issueRow, ui.journalPage.issueFallback)
  const articleCount = articles.length
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const pageTitle = buildIssueMetadataTitle(journalTitle, issueRow, locale)
  const pageDescription = buildIssueMetadataDescription(journalTitle, issueRow, articleCount, locale)
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
    issueRow.year && { label: ui.journalPage.publicationYear, value: String(issueRow.year) },
    issueRow.volume?.trim() && { label: ui.journalPage.volume, value: issueRow.volume.trim() },
    issueRow.issue_number?.trim() && { label: ui.journalPage.issueNumber, value: issueRow.issue_number.trim() },
    articleCount > 0 && {
      label: ui.journalPage.articleCount,
      value: articleCount.toLocaleString(numberLocale),
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <>
      <JsonLd data={issueJsonLd} />
      <div className="min-w-0">
      <Breadcrumb className="mb-5 md:mb-6 min-w-0" aria-label={ui.article.breadcrumb}>
        <BreadcrumbList className="min-w-0 flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink href={lp('/')} className={linkFocusClass}>{ui.article.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={lp('/journals')} className={linkFocusClass}>{ui.nav.journals}</BreadcrumbLink>
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
          <h1 className="type-page-heading leading-snug">
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
          <h2 className="type-section-title">
            {ui.article.articlesInIssue}
          </h2>
          {articleCount > 0 && (
            <p className="type-card-meta tabular-nums shrink-0">
              {articleCount.toLocaleString(numberLocale)} {ui.journalPage.articlesLabel}
            </p>
          )}
        </div>

        {articleCount === 0 ? (
          <p className="type-card-meta py-6">
            {ui.journalPage.noArticlesInIssue}
          </p>
        ) : (
          <ul className="divide-y divide-border/80 min-w-0">
            {articles.map((a) => (
              <IssueArticleRow key={a.id} article={a} locale={locale} lp={lp} ui={ui} />
            ))}
          </ul>
        )}
      </section>

      <Link
        href={arsivHref}
        className={cn(
          'type-sidebar-link inline-flex items-center gap-1 text-primary hover:text-accent mt-6 no-underline',
          linkFocusClass,
        )}
      >
        {ui.journalPage.backToArchive}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
    </>
  )
}

function CmsSection({ title, html, ui }: { title: string; html: string | null | undefined; ui: UiMessages }) {
  if (!html?.trim()) {
    return (
      <div className="catalog-empty-panel">
        <p className="font-medium text-foreground">{title}</p>
        <p className="type-card-meta mt-2">{ui.journalPage.emptySection}</p>
      </div>
    )
  }
  return (
    <section className="min-w-0 rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-7">
      <h2 className="type-section-title mb-4">{title}</h2>
      <div
        className="prose prose-sm max-w-3xl text-foreground/90 text-justify hyphens-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}

function IssueArticleRow({
  article,
  locale,
  lp,
  ui,
}: {
  article: Partial<Article>
  locale: SiteLocale
  lp: (path: string) => string
  ui: UiMessages
}) {
  const title = pickLocalizedArticleDisplayTitle(article.title_tr, article.title_en, locale)
  const href = lp(`/${article.legacy_journal_slug}/${article.slug}-${article.id}`)
  const pages = formatPageRange(article.page_start, article.page_end)
  const authorNames = parseAuthorNames(article.authors_raw)

  return (
    <li className="group py-4 first:pt-0 last:pb-0 min-w-0">
      <Link href={href} className={cn('block no-underline', linkFocusClass)}>
        <h3 className="type-list-title group-hover:text-primary transition-colors line-clamp-3">
          {title}
        </h3>
      </Link>
      <div className="mt-2 flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          {(authorNames.length > 0 || pages) && (
            <div className="type-card-meta flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              {authorNames.length > 0 && <AuthorNameLinks authorsRaw={article.authors_raw} lp={lp} />}
              {authorNames.length > 0 && pages && (
                <span className="text-muted-foreground" aria-hidden>·</span>
              )}
              {pages && (
                <span className="tabular-nums shrink-0 text-muted-foreground">{ui.journalPage.pagesShort} {pages}</span>
              )}
            </div>
          )}
        </div>
        <Link
          href={lp(`/pdfs/${article.id}`)}
          aria-label={`${title} — ${ui.article.viewPdf}`}
          className={cn('catalog-pdf-badge shrink-0', linkFocusClass)}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          PDF
        </Link>
      </div>
    </li>
  )
}

function ArticleRow({
  article,
  locale,
  lp,
  ui,
}: {
  article: Partial<Article>
  locale: SiteLocale
  lp: (path: string) => string
  ui: UiMessages
}) {
  const title = pickLocalizedArticleDisplayTitle(article.title_tr, article.title_en, locale)
  const href = lp(`/${article.legacy_journal_slug}/${article.slug}-${article.id}`)
  const pages = formatPageRange(article.page_start, article.page_end)
  const authorNames = parseAuthorNames(article.authors_raw)

  return (
    <li className="group py-4 first:pt-0 last:pb-0 min-w-0">
      <Link
        href={href}
        className={cn('block no-underline', linkFocusClass)}
      >
        <span className="type-list-title group-hover:text-primary transition-colors line-clamp-3">
          {title}
        </span>
      </Link>
      <div className="mt-2 flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          {(authorNames.length > 0 || article.published_year || pages) && (
            <div className="type-card-meta flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              {authorNames.length > 0 && <AuthorNameLinks authorsRaw={article.authors_raw} lp={lp} />}
              {authorNames.length > 0 && article.published_year && (
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
                  <span className="tabular-nums shrink-0 text-muted-foreground">{ui.journalPage.pagesShort} {pages}</span>
                </>
              )}
            </div>
          )}
        </div>
        <Link
          href={lp(`/pdfs/${article.id}`)}
          aria-label={`${title} — ${ui.article.viewPdf}`}
          className={cn('catalog-pdf-badge shrink-0', linkFocusClass)}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          PDF
        </Link>
      </div>
    </li>
  )
}
