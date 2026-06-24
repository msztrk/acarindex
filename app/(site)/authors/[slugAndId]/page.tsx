import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import * as authorData from '@/lib/data/authors'
import { JsonLd } from '@/components/seo/JsonLd'
import { dedupeAndSortAuthorArticles } from '@/lib/authors/articles'
import {
  buildAuthorMetadataDescription,
  buildAuthorMetadataTitle,
  normalizeAuthorDisplayName,
} from '@/lib/authors/display'
import { buildOrcidUrl, normalizeOrcidValue } from '@/lib/authors/orcid'
import { buildAuthorRobots, shouldEmitAuthorProfileJsonLd } from '@/lib/authors/robots'
import { buildAuthorPageJsonLd } from '@/lib/seo/author-jsonld'
import { buildAuthorUrl, parseAuthorSlugAndId } from '@/lib/urls/author'
import { cn } from '@/lib/utils'
import { hasPdf } from '@/lib/pdf/legacy-url'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { User, BookOpen, FileText, ExternalLink } from 'lucide-react'
import type { Author } from '@/types/database'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { getServerSession } from '@/lib/auth/session'
import { recordRecentView } from '@/lib/user-panel/recent-views'
import { isAuthorFollowed } from '@/lib/user-panel/follows'
import { FollowAuthorButton } from '@/components/user-panel/FollowAuthorButton'
import { buildLoginHref } from '@/lib/user-panel/login-redirect'

export interface AuthorArticleRow {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  published_year: number | null
  published_at: string | null
  journal: { id: number; slug: string; title_tr: string | null } | null
  pdf: { legacy_pdf_path: string | null; file_status: string | null } | null
}

const linkFocusClass =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

async function getAuthorUncached(id: number) {
  return authorData.getAuthorById(id)
}

const getAuthor = cache(getAuthorUncached)

async function getAuthorPublishedArticlesUncached(authorId: number): Promise<AuthorArticleRow[]> {
  const articles = await authorData.listAuthorPublishedArticles(authorId)
  return dedupeAndSortAuthorArticles(articles)
}

const getAuthorPublishedArticles = cache(getAuthorPublishedArticlesUncached)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slugAndId: string }>
}): Promise<Metadata> {
  const { slugAndId } = await params
  const parsed = parseAuthorSlugAndId(slugAndId)
  if (!parsed) return {}

  const author = await getAuthor(parsed.authorId)
  if (!author) return {}

  const articles = await getAuthorPublishedArticles(parsed.authorId)
  const displayName = normalizeAuthorDisplayName(author.name)
  const pageTitle = buildAuthorMetadataTitle(displayName)
  const description = buildAuthorMetadataDescription(displayName, articles.length)
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const canonicalPath = buildAuthorUrl(author)

  return {
    title: pageTitle,
    description,
    robots: buildAuthorRobots(author),
    alternates: { canonical: `${canonicalBase}${canonicalPath}` },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalPath,
      type: 'profile',
    },
  }
}

function AuthorArticleListItem({ article }: { article: AuthorArticleRow }) {
  const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
  const href = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const journalTitle = article.journal?.title_tr?.trim()
  const journalHref = article.journal
    ? `/journals/${article.journal.slug}-${article.journal.id}`
    : null
  const pdfPath = article.pdf?.legacy_pdf_path
  const pdfAvailable = hasPdf(pdfPath)

  return (
    <li className="min-w-0">
      <Link
        href={href}
        className={cn(
          'flex items-start gap-2 min-w-0 px-3 py-3 sm:px-4 text-sm font-medium text-primary hover:text-accent hover:bg-muted/40 transition-colors no-underline',
          linkFocusClass,
        )}
      >
        <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
        <span className="min-w-0 line-clamp-3 leading-snug">{title}</span>
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-3 sm:px-4 text-xs text-muted-foreground">
        {journalTitle && journalHref && (
          <Link
            href={journalHref}
            className={cn(
              'inline-flex items-center gap-1 hover:text-foreground no-underline min-w-0',
              linkFocusClass,
            )}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{journalTitle}</span>
          </Link>
        )}
        {article.published_year && (
          <span className="tabular-nums shrink-0">{article.published_year}</span>
        )}
        {pdfAvailable && (
          <Link
            href={`/pdfs/${article.id}`}
            className={cn(
              'inline-flex items-center gap-1 text-accent hover:text-accent/80 no-underline shrink-0',
              linkFocusClass,
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            PDF
          </Link>
        )}
      </div>
    </li>
  )
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slugAndId: string }>
}) {
  const { slugAndId } = await params
  const parsed = parseAuthorSlugAndId(slugAndId)
  if (!parsed) notFound()

  const author = await getAuthor(parsed.authorId)
  if (!author) notFound()

  const articles = await getAuthorPublishedArticles(parsed.authorId)
  const displayName = normalizeAuthorDisplayName(author.name)
  const pageTitle = buildAuthorMetadataTitle(displayName)
  const description = buildAuthorMetadataDescription(displayName, articles.length)
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const orcid = normalizeOrcidValue(author.orcid)
  const institution = author.institution?.trim()
  const authorJsonLd = shouldEmitAuthorProfileJsonLd(author)
    ? buildAuthorPageJsonLd({
        canonicalBase,
        author,
        articles,
        pageTitle,
        description,
      })
    : null

  const articlesByYear = articles.reduce<Record<number, number>>((acc, article) => {
    const year = article.published_year ?? 0
    acc[year] = (acc[year] ?? 0) + 1
    return acc
  }, {})
  const years = Object.keys(articlesByYear)
    .map(Number)
    .sort((a, b) => b - a)
  const journalCount = new Set(articles.map((article) => article.journal?.id).filter(Boolean)).size

  const authEnabled = isUserAuthEnabled()
  const session = authEnabled ? await getServerSession() : null
  const isLoggedIn = session?.user.status === 'active'
  const authorPath = `/authors/${slugAndId}`
  const loginHref = buildLoginHref(authorPath)

  if (isLoggedIn && session) {
    await recordRecentView(session.user.id, 'author', parsed.authorId)
  }

  const following =
    isLoggedIn && session
      ? await isAuthorFollowed(session.user.id, parsed.authorId)
      : false

  return (
    <>
      {authorJsonLd ? <JsonLd data={authorJsonLd} /> : null}
      <div className="content-width py-6 lg:py-10 min-w-0">
        <Breadcrumb className="mb-5 md:mb-6 min-w-0" aria-label="Breadcrumb">
          <BreadcrumbList className="min-w-0 flex-wrap">
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className={linkFocusClass}>Ana Sayfa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0 max-w-[50%] sm:max-w-md">
              <BreadcrumbPage className="line-clamp-1" title={displayName}>
                {displayName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-8 min-w-0">
          <div className="min-w-0">
            <header className="flex items-start gap-5 mb-6 md:mb-8 min-w-0">
              <div className="h-16 w-16 rounded-full bg-secondary border border-border/80 flex items-center justify-center shrink-0">
                <User className="h-8 w-8 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0 space-y-2">
                <h1 className="font-serif text-2xl sm:text-[1.75rem] font-bold text-foreground leading-snug break-words">
                  {displayName}
                </h1>
                {authEnabled && (
                  <FollowAuthorButton
                    authorId={parsed.authorId}
                    initialFollowing={following}
                    canFollow={!author.is_provisional}
                    isProvisional={author.is_provisional}
                    loginHref={loginHref}
                  />
                )}
                {institution && (
                  <p className="text-sm text-muted-foreground break-words">{institution}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    {articles.length.toLocaleString('tr-TR')} yayımlanmış makale
                  </span>
                  {orcid && (
                    <a
                      href={buildOrcidUrl(orcid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-1 text-primary hover:text-accent no-underline',
                        linkFocusClass,
                      )}
                    >
                      ORCID: {orcid}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </header>

            <section className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  Makaleler
                </h2>
                {articles.length > 0 && (
                  <p className="text-sm text-muted-foreground tabular-nums shrink-0">
                    {articles.length.toLocaleString('tr-TR')} makale
                  </p>
                )}
              </div>

              {articles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  Bu yazara ait yayımlanmış makale bulunmuyor.
                </p>
              ) : (
                <ul className="divide-y divide-border/80 min-w-0 rounded-lg border border-border/80 overflow-hidden">
                  {articles.map((article) => (
                    <AuthorArticleListItem key={article.id} article={article} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          {articles.length > 0 && (
            <aside className="space-y-4 min-w-0">
              <div className="rounded-lg border border-border/80 p-4 bg-muted/20 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-3">İstatistikler</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Makale</dt>
                    <dd className="font-medium tabular-nums">{articles.length}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Dergi</dt>
                    <dd className="font-medium tabular-nums">{journalCount}</dd>
                  </div>
                  {years[0] > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Son yayın</dt>
                      <dd className="font-medium tabular-nums">{years[0]}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {years.length > 0 && (
                <div className="rounded-lg border border-border/80 p-4 bg-muted/20 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Yıllara göre</h3>
                  <ul className="space-y-1.5">
                    {years.slice(0, 10).map((year) => (
                      <li key={year} className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {year > 0 ? year : 'Yılı belirtilmemiş'}
                        </span>
                        <span className="font-medium tabular-nums">{articlesByYear[year]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </>
  )
}
