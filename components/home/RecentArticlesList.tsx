import Link from 'next/link'
import { FileText } from 'lucide-react'

export interface RecentArticleItem {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  authors_raw: string | null
  published_year: number | null
  journal: { id: number; slug: string; title_tr: string | null } | null
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

export function RecentArticlesList({ articles }: { articles: RecentArticleItem[] }) {
  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground mb-1">Henüz makale listelenmiyor</p>
        <p className="text-sm text-muted-foreground">
          Yeni makaleler eklendiğinde burada görünecek.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border/80">
      {articles.map((a) => {
        const title = a.title_tr ?? a.title_en ?? 'Başlıksız'
        const href = `/${a.legacy_journal_slug}/${a.slug}-${a.id}`
        const authors = formatAuthors(a.authors_raw)
        const journalTitle = a.journal?.title_tr

        return (
          <li key={a.id} className="group py-4 first:pt-0 last:pb-0">
            <Link
              href={href}
              className="block no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                className="text-base font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2"
              >
                {title}
              </span>
            </Link>
            <div className="mt-2.5 space-y-1.5">
              {(authors || a.published_year) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-[0.8125rem] text-foreground/70">
                  {authors && <span className="min-w-0">{authors}</span>}
                  {authors && a.published_year && <span className="text-muted-foreground" aria-hidden>·</span>}
                  {a.published_year && (
                    <span className="tabular-nums shrink-0 text-muted-foreground">{a.published_year}</span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 min-w-0">
                {journalTitle && a.journal && (
                  <Link
                    href={`/journals/${a.journal.slug}-${a.journal.id}`}
                    title={journalTitle}
                    className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-foreground/75 hover:text-foreground line-clamp-2 sm:line-clamp-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
                  >
                    {journalTitle}
                  </Link>
                )}
                <Link
                  href={`/pdfs/${a.id}`}
                  aria-label={`${title} — tam metin PDF`}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 hover:border-primary/50 transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
