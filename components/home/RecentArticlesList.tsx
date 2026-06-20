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
    <ul className="divide-y divide-border">
      {articles.map((a) => {
        const title = a.title_tr ?? a.title_en ?? 'Başlıksız'
        const href = `/${a.legacy_journal_slug}/${a.slug}-${a.id}`
        const authors = formatAuthors(a.authors_raw)

        return (
          <li key={a.id} className="group py-4 first:pt-0">
            <Link href={href} className="block no-underline">
              <span
                className="text-[0.9375rem] font-normal text-foreground/90 group-hover:text-primary transition-colors leading-[1.45] line-clamp-2"
              >
                {title}
              </span>
            </Link>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                {authors && <span className="truncate max-w-full">{authors}</span>}
                {authors && a.published_year && <span aria-hidden>·</span>}
                {a.published_year && <span className="tabular-nums shrink-0">{a.published_year}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                {a.journal?.title_tr && (
                  <Link
                    href={`/journals/${a.journal.slug}-${a.journal.id}`}
                    className="hover:text-foreground truncate max-w-full sm:max-w-[280px]"
                  >
                    {a.journal.title_tr}
                  </Link>
                )}
                <Link
                  href={`/pdfs/${a.id}`}
                  className="inline-flex items-center gap-1 shrink-0 rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors no-underline"
                >
                  <FileText className="h-3 w-3" aria-hidden />
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
