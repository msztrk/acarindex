import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseArticlePath, extractArticleId } from '@/lib/urls/article'
import { buildLegacyPdfUrl, buildPdfViewerUrl, hasPdf } from '@/lib/pdf/legacy-url'
import { cn, buttonVariants } from '@/lib/utils'
import { JsonLd } from '@/components/seo/JsonLd'
import { CitationMeta } from '@/components/seo/CitationMeta'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

async function getArticle(articleId: number): Promise<ArticleRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articles')
    .select(`
      id, slug, legacy_journal_slug, journal_id, issue_id,
      title_tr, title_en, abstract_tr, abstract_en,
      keywords_tr, keywords_en, references_raw,
      authors_raw, institution_raw,
      page_start, page_end, published_year, published_at,
      language, status, hit_count, doi,
      journal:journals (
        id, slug, title_tr, title_en, issn, eissn, publisher, cover_path
      ),
      issue:issues (
        id, year, issue_label, volume, issue_number
      ),
      pdf:pdf_files (
        legacy_pdf_path, file_status, cdn_url
      )
    `)
    .eq('id', articleId)
    .eq('status', 'published')
    .single()

  if (error || !data) return null
  return data as unknown as ArticleRow
}

async function getArticleAuthorLinks(articleId: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('article_authors')
    .select(`
      author_position,
      raw_author_name,
      author:authors ( id, slug, name )
    `)
    .eq('article_id', articleId)
    .order('author_position', { ascending: true })

  return (data ?? []) as Array<{
    author_position: number | null
    raw_author_name: string | null
    author: { id: number; slug: string | null; name: string } | null
  }>
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { journalSlug, articleSlugAndId } = await params
  const parsed = parseArticlePath(journalSlug, articleSlugAndId)
  const articleId = parsed?.articleId ?? extractArticleId(articleSlugAndId)
  if (!articleId) return {}

  const article = await getArticle(articleId)
  if (!article) return { title: 'Makale bulunamadı' }

  const title = article.title_tr ?? article.title_en ?? 'Makale'
  const description = article.abstract_tr ?? article.abstract_en ?? undefined
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const canonicalUrl = `${canonicalBase}/${article.legacy_journal_slug}/${article.slug}-${article.id}`

  const legacyCoverUrl = article.journal?.cover_path
    ? `https://www.acarindex.com/${article.journal.cover_path}`
    : null

  return {
    title,
    description: description?.slice(0, 160),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description: description?.slice(0, 200),
      type: 'article',
      publishedTime: article.published_at ?? undefined,
      ...(legacyCoverUrl ? { images: [{ url: legacyCoverUrl, width: 200, height: 280 }] } : {}),
    },
  }
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: PageProps) {
  const { journalSlug, articleSlugAndId } = await params

  const parsed = parseArticlePath(journalSlug, articleSlugAndId)
  const articleId = parsed?.articleId ?? extractArticleId(articleSlugAndId)

  if (!articleId) notFound()

  const article = await getArticle(articleId)
  if (!article) notFound()

  const authorLinks = await getArticleAuthorLinks(articleId)

  // Dergi ve sayı bilgileri
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
  const abstract = article.abstract_tr ?? article.abstract_en
  const journalTitle = journal?.title_tr ?? journal?.title_en ?? ''

  // Yazar listesi (ham string parse)
  const authorsList: string[] = article.authors_raw
    ? article.authors_raw
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
    : []

  // PDF
  const legacyPdfPath = pdf?.legacy_pdf_path ?? null
  const pdfAvailable = hasPdf(legacyPdfPath)
  const pdfDirectUrl = buildLegacyPdfUrl(legacyPdfPath)
  const pdfViewerUrl = buildPdfViewerUrl(article.id)

  // JSON-LD
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const canonicalUrl = `${canonicalBase}/${article.legacy_journal_slug}/${article.slug}-${article.id}`
  const journalUrl = journal ? `${canonicalBase}/journals/${journal.slug}-${journal.id}` : undefined

  const articleSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: title,
    alternativeHeadline: titleOther ?? undefined,
    description: abstract?.slice(0, 300) ?? undefined,
    abstract: abstract ?? undefined,
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

  return (
    <>
      {/* SEO Head */}
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

      <div className="content-width py-6 lg:py-10">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Ana Sayfa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {journal && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/journals/${journal.slug}-${journal.id}`}>
                    {journalTitle}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate max-w-[200px] sm:max-w-none">
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Ana içerik */}
          <article>
            {/* Başlık */}
            <header className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground leading-tight mb-2">
                {title}
              </h1>
              {titleOther && (
                <p className="text-base text-muted-foreground italic">{titleOther}</p>
              )}
            </header>

            {/* Meta bant */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {article.published_year && (
                <Badge variant="secondary">{article.published_year}</Badge>
              )}
              {article.language && (
                <Badge variant="outline" className="uppercase text-xs">
                  {article.language}
                </Badge>
              )}
              {article.page_start && article.page_end && (
                <span className="text-sm text-muted-foreground">
                  ss. {article.page_start}–{article.page_end}
                </span>
              )}
              {article.doi && (
                <a
                  href={`https://doi.org/${article.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  DOI <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Yazarlar */}
            {(authorLinks.length > 0 || authorsList.length > 0) && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Yazarlar
                </h2>
                <div className="flex flex-wrap gap-2">
                  {authorLinks.length > 0
                    ? authorLinks.map((row) => {
                        const name = row.author?.name ?? row.raw_author_name ?? 'Yazar'
                        const href = row.author
                          ? `/authors/${row.author.slug ?? row.author.id}-${row.author.id}`
                          : `/search?q=${encodeURIComponent(name)}&area=author`
                        return (
                          <Link
                            key={`${row.author?.id ?? name}-${row.author_position}`}
                            href={href}
                            className="text-sm text-primary hover:text-accent"
                          >
                            {name}
                          </Link>
                        )
                      })
                    : authorsList.map((author, i) => (
                        <Link
                          key={i}
                          href={`/search?q=${encodeURIComponent(author)}&area=author`}
                          className="text-sm text-primary hover:text-accent"
                        >
                          {author}
                        </Link>
                      ))}
                </div>
              </div>
            )}

            {/* Kurum */}
            {article.institution_raw && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Kurum
                </h2>
                <p className="text-sm text-muted-foreground">{article.institution_raw}</p>
              </div>
            )}

            <Separator className="my-6" />

            {/* Özet */}
            {abstract && (
              <section className="mb-8">
                <h2 className="text-lg font-serif font-semibold mb-3">Özet</h2>
                <p className="text-base leading-relaxed text-foreground/90 reading-width">
                  {abstract}
                </p>
                {/* İngilizce özet */}
                {article.abstract_en && article.abstract_tr && article.abstract_en !== abstract && (
                  <details className="mt-4">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      Abstract (English)
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground italic">
                      {article.abstract_en}
                    </p>
                  </details>
                )}
              </section>
            )}

            {/* Anahtar kelimeler */}
            {(article.keywords_tr || article.keywords_en) && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Anahtar Kelimeler
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(article.keywords_tr ?? article.keywords_en ?? '')
                    .replace(/anahtar kelimeler[:;]?/i, '')
                    .replace(/keywords[:;]?/i, '')
                    .split(/[,;]/)
                    .map((kw) => kw.trim())
                    .filter(Boolean)
                    .map((kw, i) => (
                      <Link
                        key={i}
                        href={`/search?q=${encodeURIComponent(kw)}&area=keywords`}
                        className="no-underline"
                      >
                        <Badge
                          variant="outline"
                          className="hover:bg-secondary cursor-pointer transition-colors"
                        >
                          {kw}
                        </Badge>
                      </Link>
                    ))}
                </div>
              </section>
            )}

            {/* Kaynakça */}
            {article.references_raw && (
              <section>
                <h2 className="text-lg font-serif font-semibold mb-3">Kaynakça</h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {article.references_raw}
                </div>
              </section>
            )}
          </article>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* PDF Erişim */}
            <div className="rounded-lg border border-border p-4 bg-card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Tam Metin
              </h3>
              {pdfAvailable ? (
                <div className="space-y-2">
                  <Link
                    href={pdfViewerUrl}
                    className={cn(buttonVariants({ size: 'sm' }), 'w-full justify-center')}
                  >
                    Görüntüle
                  </Link>
                  {pdfDirectUrl && (
                    <a
                      href={pdfDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
                    >
                      PDF İndir
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Bu makale için tam metin mevcut değil.
                </p>
              )}
            </div>

            {/* Dergi bilgisi */}
            {journal && (
              <div className="rounded-lg border border-border p-4 bg-card">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" />
                  Dergi
                </h3>
                <Link
                  href={`/journals/${journal.slug}-${journal.id}`}
                  className="text-sm font-medium text-primary hover:text-accent leading-snug"
                >
                  {journalTitle}
                </Link>
                {journal.issn && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ISSN: {journal.issn}
                    {journal.eissn && ` / E-ISSN: ${journal.eissn}`}
                  </p>
                )}
                {journal.publisher && (
                  <p className="text-xs text-muted-foreground mt-0.5">{journal.publisher}</p>
                )}
                {issue && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                    {issue.issue_label ?? `${issue.year ?? ''}`}
                  </p>
                )}
              </div>
            )}

            {/* Makale bilgisi */}
            <div className="rounded-lg border border-border p-4 bg-card text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Makale ID:</span> {article.id}</p>
              {article.published_year && (
                <p><span className="font-medium text-foreground">Yıl:</span> {article.published_year}</p>
              )}
              {article.page_start && (
                <p>
                  <span className="font-medium text-foreground">Sayfalar:</span>{' '}
                  {article.page_start}–{article.page_end}
                </p>
              )}
              {article.doi && (
                <p>
                  <span className="font-medium text-foreground">DOI:</span>{' '}
                  <a
                    href={`https://doi.org/${article.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline break-all"
                  >
                    {article.doi}
                  </a>
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
