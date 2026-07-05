import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { SiteLocale } from '@/lib/i18n/locale'
import { pickLocalizedArticleDisplayTitle } from '@/lib/i18n/pick-localized-text'
import { pickLocalizedTitle } from '@/lib/seo/hreflang'

export interface RecentArticleItem {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  authors_raw: string | null
  published_year: number | null
  journal: { id: number; slug: string; title_tr: string | null; title_en?: string | null } | null
}

function formatAuthors(raw: string | null): string {
  if (!raw) return ''
  return raw
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')
}

export function RecentArticlesList({
  articles,
  locale = 'tr',
}: {
  articles: RecentArticleItem[]
  locale?: SiteLocale
}) {
  if (articles.length === 0) {
    return (
      <div className="home-surface-card border-dashed px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground mb-1">Henüz makale listelenmiyor</p>
        <p className="text-sm text-muted-foreground">
          Yeni makaleler eklendiğinde burada görünecek.
        </p>
      </div>
    )
  }

  return (
    <ul
      className="-mx-4 divide-y divide-border/60 bg-transparent sm:mx-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-border/80 sm:bg-surface sm:shadow-sm"
      data-d2-recent-articles
    >
      {articles.map((a) => {
        const title = pickLocalizedArticleDisplayTitle(a.title_tr, a.title_en, locale)
        const href = `/${a.legacy_journal_slug}/${a.slug}-${a.id}`
        const authors = formatAuthors(a.authors_raw)
        const journalTitle = a.journal
          ? pickLocalizedTitle(a.journal.title_tr, a.journal.title_en, locale)
          : null

        return (
          <li key={a.id} className="group px-4 py-3.5 transition-colors hover:bg-brand-primary/[0.035] sm:px-5 sm:py-4">
            <Link
              href={href}
              className="block no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                className="text-[1.0625rem] font-medium text-foreground group-hover:text-brand-primary transition-colors leading-[1.45] line-clamp-2"
              >
                {title}
              </span>
            </Link>
            <div className="mt-2.5 space-y-2">
              {(authors || a.published_year) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-[0.8125rem] text-muted-foreground">
                  {authors && <span className="min-w-0">{authors}</span>}
                  {authors && a.published_year && (
                    <span className="text-border" aria-hidden>·</span>
                  )}
                  {a.published_year && (
                    <span className="tabular-nums shrink-0">{a.published_year}</span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 min-w-0">
                {journalTitle && a.journal && (
                  <Link
                    href={`/journals/${a.journal.slug}-${a.journal.id}`}
                    title={journalTitle}
                    className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-foreground/70 hover:text-brand-secondary line-clamp-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
                  >
                    {journalTitle}
                  </Link>
                )}
                <Link
                  href={`/pdfs/${a.id}`}
                  aria-label={`${title} — tam metin PDF`}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-brand-accent/30 bg-brand-accent/10 px-2.5 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-accent/18 hover:border-brand-accent/45 transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden />
                  PDF
                </Link>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
