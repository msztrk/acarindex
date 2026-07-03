import { notFound, redirect } from 'next/navigation'
import { resolveReservedJournalSlugRedirect } from '@/lib/seo/legacy-auth-redirects'
import type { Metadata } from 'next'
import Link from 'next/link'
import * as articleData from '@/lib/data/articles'
import { listArticlesForIssue } from '@/lib/data/journals'
import { parseArticlePath, extractArticleId } from '@/lib/urls/article'
import { buildAuthorUrl } from '@/lib/urls/author'
import { buildLegacyPdfUrl, buildPdfViewerUrl, hasPdf } from '@/lib/pdf/legacy-url'
import { cn, buttonVariants } from '@/lib/utils'
import { JsonLd } from '@/components/seo/JsonLd'
import { CitationMeta } from '@/components/seo/CitationMeta'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { FileText, BookOpen, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { getServerSession } from '@/lib/auth/session'
import { recordRecentView } from '@/lib/user-panel/recent-views'
import { isArticleSaved } from '@/lib/user-panel/saved-articles'
import { listReadingLists } from '@/lib/user-panel/reading-lists'
import { ArticleSaveActions } from '@/components/user-panel/ArticleSaveActions'
import { buildLoginHref } from '@/lib/user-panel/login-redirect'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { buildArticleMetadataAlternates, pickLocalizedTitle } from '@/lib/seo/hreflang'
import { buildArticlePath } from '@/lib/i18n/slugs'
import { hasEnglishArticleContent } from '@/lib/i18n/content-availability'

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface ArticleRow {
  id: number
  slug: string
  legacy_journal_slug: string
  journal_id: number
  issue_id: number | null
  title_tr: string | null
  title_en: string | null
  abstract_tr: string | null
  abstract_en: string | null
  keywords_tr: string | null
  keywords_en: string | null
  references_raw: string | null
  authors_raw: string | null
  institution_raw: string | null
  page_start: number | null
  page_end: number | null
  published_year: number | null
  published_at: string | null
  language: string | null
  status: string
  hit_count: number
  doi: string | null
  journal: {
    id: number
    slug: string
    title_tr: string | null
    title_en: string | null
    issn: string | null
    eissn: string | null
    publisher: string | null
    cover_path: string | null
  } | null
  issue: {
    id: number
    year: number | null
    issue_label: string | null
    volume: string | null
    issue_number: string | null
  } | null
  pdf: {
    legacy_pdf_path: string | null
    file_status: string
    cdn_url: string | null
  } | null
}

interface PageProps {
  params: Promise<{
    journalSlug: string
    articleSlugAndId: string
  }>
}

// ─── Veri çekme ──────────────────────────────────────────────────────────────

async function getArticle(articleId: number) {
  return articleData.getPublishedArticleDetailById(articleId)
}

async function getArticleAuthorLinks(articleId: number) {
  const rows = await articleData.listArticleAuthorsForArticle(articleId)
  return rows.map((r) => ({
    author_position: r.author_position,
    raw_author_name: r.raw_author_name,
    author: r.author
      ? { id: r.author.id, slug: r.author.slug, name: r.author.name }
      : null,
  }))
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { journalSlug, articleSlugAndId } = await params
  const parsed = parseArticlePath(journalSlug, articleSlugAndId)
  const articleId = parsed?.articleId ?? extractArticleId(articleSlugAndId)
  if (!articleId) return {}

  const article = await getArticle(articleId)
  if (!article) return { title: 'Makale bulunamadı' }

  const locale = await getRequestLocale()
  const title = pickLocalizedTitle(article.title_tr, article.title_en, locale) || 'Makale'
  const description =
    (locale === 'en' ? article.abstract_en ?? article.abstract_tr : article.abstract_tr ?? article.abstract_en) ??
    undefined
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const alternates = buildArticleMetadataAlternates(
    canonicalBase,
    {
      id: article.id,
      slug: article.slug,
      slugTr: article.slug_tr,
      slugEn: article.slug_en,
      legacyJournalSlug: article.legacy_journal_slug,
      legacyJournalSlugEn: article.legacy_journal_slug_en,
      titleTr: article.title_tr,
      titleEn: article.title_en,
      abstractTr: article.abstract_tr,
      abstractEn: article.abstract_en,
      language: article.language,
      documentLanguage: article.document_language,
      hasEnContent: article.has_en_content,
    },
    locale,
  )

  const legacyCoverUrl = article.journal?.cover_path
    ? `https://www.acarindex.com/${article.journal.cover_path}`
    : null

  return {
    title,
    description: description?.slice(0, 160),
    alternates,
    openGraph: {
      title,
      description: description?.slice(0, 200),
      type: 'article',
      publishedTime: article.published_at ?? undefined,
      ...(legacyCoverUrl ? { images: [{ url: legacyCoverUrl, width: 200, height: 280 }] } : {}),
    },
  }
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

const linkFocusClass =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

function parseKeywords(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .replace(/anahtar kelimeler[:;]?/i, '')
    .replace(/keywords[:;]?/i, '')
    .split(/[,;]/)
    .map((kw) => kw.trim())
    .filter(Boolean)
}

function formatPageRange(start: number | null, end: number | null): string | null {
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

function AuthorLinks({
  authorLinks,
  authorsList,
}: {
  authorLinks: Awaited<ReturnType<typeof getArticleAuthorLinks>>
  authorsList: string[]
}) {
  const entries =
    authorLinks.length > 0
      ? authorLinks.map((row) => {
          const name = row.author?.name ?? row.raw_author_name ?? 'Yazar'
          const href = row.author ? buildAuthorUrl(row.author) : `/search?q=${encodeURIComponent(name)}&area=author`
          return { key: `${row.author?.id ?? name}-${row.author_position}`, name, href }
        })
      : authorsList.map((name, i) => ({
          key: `raw-${i}-${name}`,
          name,
          href: `/search?q=${encodeURIComponent(name)}&area=author`,
        }))

  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0">
      {entries.map((entry, index) => (
        <span key={entry.key} className="inline-flex items-center gap-1 min-w-0">
          <Link
            href={entry.href}
            className={cn(
              'text-sm font-medium text-primary hover:text-accent transition-colors no-underline',
              linkFocusClass,
            )}
          >
            {entry.name}
          </Link>
          {index < entries.length - 1 && (
            <span className="text-muted-foreground" aria-hidden>,</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: PageProps) {
  const { journalSlug, articleSlugAndId } = await params

  const reservedRedirect = resolveReservedJournalSlugRedirect(journalSlug)
  if (reservedRedirect) {
    redirect(reservedRedirect)
  }

  const parsed = parseArticlePath(journalSlug, articleSlugAndId)
  const articleId = parsed?.articleId ?? extractArticleId(articleSlugAndId)

  if (!articleId) notFound()

  const article = await getArticle(articleId)
  if (!article) notFound()

  const locale = await getRequestLocale()
  const hasEn = article.has_en_content || hasEnglishArticleContent({
    titleEn: article.title_en,
    abstractEn: article.abstract_en,
    language: article.language,
    documentLanguage: article.document_language,
  })
  if (locale === 'en' && !hasEn) {
    redirect(
      buildArticlePath(
        {
          id: article.id,
          slug: article.slug,
          slugTr: article.slug_tr,
          slugEn: article.slug_en,
          legacyJournalSlug: article.legacy_journal_slug,
          legacyJournalSlugEn: article.legacy_journal_slug_en,
        },
        'tr',
      ),
    )
  }

  const authorLinks = await getArticleAuthorLinks(articleId)

  const journal = article.journal
  const issue = article.issue
  const pdf = article.pdf

  const title = article.title_tr ?? article.title_en ?? 'Başlıksız'
  const titleOtherRaw = article.title_en ?? article.title_tr
  const titleOther =
    titleOtherRaw &&
    titleOtherRaw.trim() !== '-' &&
    titleOtherRaw.trim() !== title.trim()
      ? titleOtherRaw
      : null

  const abstractTr = article.abstract_tr?.trim() || null
  const abstractEn =
    article.abstract_en?.trim() &&
    article.abstract_en.trim() !== '-' &&
    article.abstract_en.trim() !== abstractTr
      ? article.abstract_en.trim()
      : null

  const journalTitle = journal?.title_tr ?? journal?.title_en ?? ''
  const journalHref = journal ? `/journals/${journal.slug}-${journal.id}` : null
  const issueHref =
    journal && issue
      ? `/journals/${journal.slug}-${journal.id}/sayi/${issue.id}`
      : null

  const authorsList: string[] = article.authors_raw
    ? article.authors_raw
        .split(/[,;]+/)
        .map((a) => a.trim())
        .filter(Boolean)
    : []

  const legacyPdfPath = pdf?.legacy_pdf_path ?? null
  const pdfAvailable = hasPdf(legacyPdfPath)
  const pdfDirectUrl = buildLegacyPdfUrl(legacyPdfPath)
  const pdfViewerUrl = buildPdfViewerUrl(article.id)

  const pageRange = formatPageRange(article.page_start, article.page_end)
  const keywords = [
    ...new Set([
      ...parseKeywords(article.keywords_tr),
      ...parseKeywords(article.keywords_en),
    ]),
  ]

  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const canonicalUrl = `${canonicalBase}/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const journalUrl = journal ? `${canonicalBase}/journals/${journal.slug}-${journal.id}` : undefined

  const articleSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: title,
    alternativeHeadline: titleOther ?? undefined,
    description: (abstractTr ?? abstractEn)?.slice(0, 300) ?? undefined,
    abstract: abstractTr ?? abstractEn ?? undefined,
    author: authorsList.map((name) => ({ '@type': 'Person', name })),
    publisher: {
      '@type': 'Organization',
      name: journalTitle || 'AcarIndex',
      url: journalUrl,
    },
    isPartOf: {
      '@type': 'Periodical',
      name: journalTitle,
      issn: journal?.issn ?? undefined,
      url: journalUrl,
    },
    pageStart: article.page_start ?? undefined,
    pageEnd: article.page_end ?? undefined,
    datePublished: article.published_year ? String(article.published_year) : undefined,
    keywords: [article.keywords_tr, article.keywords_en].filter(Boolean).join(', ') || undefined,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    inLanguage: article.language ?? 'tr',
    ...(article.doi ? { identifier: { '@type': 'PropertyValue', propertyID: 'doi', value: article.doi } } : {}),
    ...(pdfDirectUrl ? { encoding: { '@type': 'MediaObject', contentUrl: pdfDirectUrl, encodingFormat: 'application/pdf' } } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, item: { '@id': canonicalBase + '/', name: 'Ana Sayfa' } },
      { '@type': 'ListItem', position: 2, item: { '@id': journalUrl, name: journalTitle } },
      { '@type': 'ListItem', position: 3, item: { '@id': canonicalUrl, name: title } },
    ],
  }

  const authEnabled = isUserAuthEnabled()
  const session = authEnabled ? await getServerSession() : null
  const isLoggedIn = session?.user.status === 'active'
  const articlePath = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const loginHref = buildLoginHref(articlePath)

  if (isLoggedIn && session) {
    await recordRecentView(session.user.id, 'article', articleId)
  }

  const initialSaved =
    isLoggedIn && session ? await isArticleSaved(session.user.id, articleId) : false
  const initialLists =
    isLoggedIn && session ? await listReadingLists(session.user.id) : []

  const issueArticles = issue?.id
    ? (await listArticlesForIssue(issue.id)).filter((a) => a.id !== articleId)
    : []

  const hasAuthors = authorLinks.length > 0 || authorsList.length > 0
  const hasPublicationMeta =
    journalTitle ||
    article.published_year ||
    issue?.volume ||
    issue?.issue_number ||
    issue?.issue_label ||
    pageRange ||
    article.language ||
    article.doi

  return (
    <>
      <CitationMeta
        title={title}
        authors={authorsList}
        journalTitle={journalTitle}
        issn={journal?.issn}
        year={article.published_year}
        volume={issue?.volume}
        issue={issue?.issue_number}
        pageStart={article.page_start}
        pageEnd={article.page_end}
        pdfUrl={pdfDirectUrl ?? undefined}
        doi={article.doi}
        language={article.language}
        abstract={article.abstract_tr ?? article.abstract_en}
      />
      <JsonLd data={[articleSchema, breadcrumbSchema]} />

      <div className="content-width py-6 lg:py-10 min-w-0">
        <Breadcrumb className="mb-5 md:mb-6 min-w-0" aria-label="Gezinme yolu">
          <BreadcrumbList className="min-w-0">
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className={linkFocusClass}>Ana Sayfa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {journal && journalHref && (
              <>
                <BreadcrumbItem className="min-w-0 max-w-[40%] sm:max-w-[50%]">
                  <BreadcrumbLink
                    href={journalHref}
                    className={cn('line-clamp-1', linkFocusClass)}
                    title={journalTitle}
                  >
                    {journalTitle}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            {issueHref ? (
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbLink
                  href={issueHref}
                  className={cn('line-clamp-1', linkFocusClass)}
                >
                  {[article.published_year, issue?.issue_label ?? issue?.issue_number]
                    .filter(Boolean)
                    .join(' · ')}
                </BreadcrumbLink>
              </BreadcrumbItem>
            ) : article.published_year ? (
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="line-clamp-1">
                  {article.published_year}
                </BreadcrumbPage>
              </BreadcrumbItem>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-8 min-w-0">
          <article className="min-w-0 rounded-xl border border-border/80 bg-surface p-5 sm:p-7 lg:p-8">
            <header className="mb-6 md:mb-8 space-y-4">
              <div className="space-y-2 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight text-foreground max-w-5xl">
                  {title}
                </h1>
                {titleOther && (
                  <p className="text-[0.9375rem] sm:text-base text-muted-foreground leading-snug">
                    {titleOther}
                  </p>
                )}
                <ArticleSaveActions
                  articleId={articleId}
                  initialSaved={initialSaved}
                  initialLists={initialLists}
                  authEnabled={authEnabled}
                  isLoggedIn={isLoggedIn}
                  loginHref={loginHref}
                />
              </div>

              {hasAuthors && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Yazarlar</p>
                  <AuthorLinks authorLinks={authorLinks} authorsList={authorsList} />
                </div>
              )}

              {hasPublicationMeta && (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 pt-1 min-w-0">
                  {journalTitle && journalHref && (
                    <MetadataItem label="Dergi">
                      <Link
                        href={journalHref}
                        className={cn(
                          'text-primary hover:text-accent transition-colors no-underline line-clamp-2',
                          linkFocusClass,
                        )}
                        title={journalTitle}
                      >
                        {journalTitle}
                      </Link>
                    </MetadataItem>
                  )}
                  {article.published_year && (
                    <MetadataItem label="Yayın yılı">
                      {article.published_year}
                    </MetadataItem>
                  )}
                  {issue?.volume && (
                    <MetadataItem label="Cilt">
                      {issueHref ? (
                        <Link
                          href={issueHref}
                          className={cn('text-primary hover:text-accent no-underline', linkFocusClass)}
                        >
                          {issue.volume}
                        </Link>
                      ) : (
                        issue.volume
                      )}
                    </MetadataItem>
                  )}
                  {(issue?.issue_number || issue?.issue_label) && (
                    <MetadataItem label="Sayı">
                      {issueHref ? (
                        <Link
                          href={issueHref}
                          className={cn(
                            'text-primary hover:text-accent no-underline line-clamp-2',
                            linkFocusClass,
                          )}
                          title={issue.issue_label ?? issue.issue_number ?? undefined}
                        >
                          {issue.issue_number ?? issue.issue_label}
                        </Link>
                      ) : (
                        <span className="line-clamp-2">{issue.issue_number ?? issue.issue_label}</span>
                      )}
                    </MetadataItem>
                  )}
                  {pageRange && (
                    <MetadataItem label="Sayfalar">
                      <span className="tabular-nums">{pageRange}</span>
                    </MetadataItem>
                  )}
                  {article.language && (
                    <MetadataItem label="Dil">
                      {article.language.toUpperCase()}
                    </MetadataItem>
                  )}
                  {article.doi && (
                    <MetadataItem label="DOI">
                      <a
                        href={`https://doi.org/${article.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'inline-flex items-center gap-1 text-primary hover:text-accent break-all no-underline',
                          linkFocusClass,
                        )}
                      >
                        {article.doi}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </a>
                    </MetadataItem>
                  )}
                </dl>
              )}

              {pdfAvailable && (
                <div className="flex flex-wrap items-center gap-3 pt-1 lg:hidden">
                  <Link
                    href={pdfViewerUrl}
                    aria-label={`${title} — PDF görüntüle`}
                    className={cn(
                      buttonVariants(),
                      'inline-flex items-center gap-2 min-h-[44px] px-5 no-underline',
                      linkFocusClass,
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    PDF Görüntüle
                  </Link>
                  {pdfDirectUrl && (
                    <a
                      href={pdfDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: 'outline' }),
                        'inline-flex items-center gap-2 min-h-[44px] px-4 no-underline',
                        linkFocusClass,
                      )}
                      aria-label={`${title} — PDF indir`}
                    >
                      PDF İndir
                    </a>
                  )}
                </div>
              )}
            </header>

            {abstractTr && (
              <section className="mb-8 min-w-0 max-w-[900px]">
                <h2 className="text-lg font-serif font-semibold text-foreground mb-3">Özet</h2>
                <div className="text-base leading-relaxed text-foreground/90 whitespace-pre-line text-justify hyphens-auto">
                  {abstractTr}
                </div>
              </section>
            )}

            {abstractEn && (
              <section className="mb-8 min-w-0 max-w-[900px]">
                <h2 className="text-lg font-serif font-semibold text-foreground mb-3">Abstract</h2>
                <div className="text-base leading-relaxed text-foreground/85 whitespace-pre-line text-justify hyphens-auto">
                  {abstractEn}
                </div>
              </section>
            )}

            {keywords.length > 0 && (
              <section className="mb-8 min-w-0">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">Anahtar kelimeler</h2>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <Link
                      key={kw}
                      href={`/search?q=${encodeURIComponent(kw)}&area=keywords`}
                      className={cn('no-underline max-w-full', linkFocusClass)}
                    >
                      <Badge
                        variant="outline"
                        className="text-[0.6875rem] text-muted-foreground hover:bg-secondary cursor-pointer transition-colors max-w-full truncate"
                      >
                        {kw}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {article.institution_raw?.trim() && (
              <section className="mb-8 min-w-0">
                <h2 className="text-sm font-medium text-muted-foreground mb-1.5">Kurum</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">{article.institution_raw}</p>
              </section>
            )}

            {article.references_raw?.trim() && (
              <section className="min-w-0 max-w-[900px]">
                <h2 className="text-lg font-serif font-semibold text-foreground mb-3">Kaynakça</h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {article.references_raw}
                </div>
              </section>
            )}
          </article>

          <aside className="space-y-5 min-w-0 lg:pt-1">
            {pdfAvailable && (
              <div className="aside-panel min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  Tam metin
                </h3>
                <div className="space-y-2">
                  <Link
                    href={pdfViewerUrl}
                    aria-label={`${title} — PDF görüntüle`}
                    className={cn(
                      buttonVariants({ size: 'sm' }),
                      'w-full justify-center min-h-[40px] no-underline',
                      linkFocusClass,
                    )}
                  >
                    PDF Görüntüle
                  </Link>
                  {pdfDirectUrl && (
                    <a
                      href={pdfDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${title} — PDF indir`}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'w-full justify-center min-h-[40px] no-underline',
                        linkFocusClass,
                      )}
                    >
                      PDF İndir
                    </a>
                  )}
                </div>
              </div>
            )}

            {journal && journalHref && (
              <div className="aside-panel min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  Dergi
                </h3>
                <Link
                  href={journalHref}
                  className={cn(
                    'text-sm font-medium text-primary hover:text-accent leading-snug line-clamp-3 no-underline',
                    linkFocusClass,
                  )}
                  title={journalTitle}
                >
                  {journalTitle}
                </Link>
                {journal.issn && (
                  <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                    ISSN: {journal.issn}
                    {journal.eissn && ` · E-ISSN: ${journal.eissn}`}
                  </p>
                )}
                {journal.publisher && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{journal.publisher}</p>
                )}
                {issue && (issue.issue_label || issue.issue_number) && issueHref && (
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/80">
                    <Link
                      href={issueHref}
                      className={cn('text-primary hover:text-accent no-underline', linkFocusClass)}
                    >
                      {issue.issue_label ?? issue.issue_number}
                    </Link>
                  </p>
                )}
              </div>
            )}

            {issueArticles.length > 0 && issueHref && (
              <div className="aside-panel min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  Bu sayıdaki makaleler
                </h3>
                <ul className="space-y-0 divide-y divide-border/60 -mx-4">
                  {issueArticles.slice(0, 5).map((a) => {
                    const aTitle = a.title_tr ?? a.title_en ?? 'Başlıksız'
                    const aHref = `/${a.legacy_journal_slug}/${a.slug}-${a.id}`
                    return (
                      <li key={a.id}>
                        <Link
                          href={aHref}
                          className={cn(
                            'block px-4 py-2.5 text-[0.8125rem] leading-snug text-foreground/80 hover:text-primary hover:bg-brand-primary/[0.035] transition-colors no-underline line-clamp-3',
                            linkFocusClass,
                          )}
                          title={aTitle}
                        >
                          {aTitle}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                {issueArticles.length > 10 && (
                  <Link
                    href={issueHref}
                    className={cn(
                      'mt-3 pt-3 border-t border-border/80 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-accent no-underline',
                      linkFocusClass,
                    )}
                  >
                    Tüm makaleleri gör ({issueArticles.length})
                  </Link>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
