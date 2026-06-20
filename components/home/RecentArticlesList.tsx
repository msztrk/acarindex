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
      <p className="text-sm text-muted-foreground py-6">Henüz makale bulunamadı.</p>
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
            <Link
              href={href}
              className="block no-underline"
            >
              <span className="font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                {title}
              </span>
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {authors && <span className="truncate max-w-full">{authors}</span>}
              {authors && a.published_year && <span aria-hidden>·</span>}
              {a.published_year && <span>{a.published_year}</span>}
              {a.journal?.title_tr && (
                <>
                  <span aria-hidden>·</span>
                  <Link
                    href={`/journals/${a.journal.slug}-${a.journal.id}`}
                    className="hover:text-foreground truncate max-w-[200px]"
                  >
                    {a.journal.title_tr}
                  </Link>
                </>
              )}
              <Link
                href={`/pdfs/${a.id}`}
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <FileText className="h-3 w-3" /> PDF
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
