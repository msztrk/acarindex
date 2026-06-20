import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export interface FeaturedJournalItem {
  id: number
  slug: string
  title_tr: string | null
  issn: string | null
  hit_count: number | null
}

export function FeaturedJournalsList({ journals }: { journals: FeaturedJournalItem[] }) {
  if (journals.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-1">Öne çıkan dergiler</h2>
        <p className="text-sm text-muted-foreground py-2">
          Öne çıkan dergi listesi henüz hazır değil.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-1">Öne çıkan dergiler</h2>
      <p className="text-xs text-muted-foreground mb-4">Sayfa görüntülenmesine göre</p>
      <ol className="space-y-3">
        {journals.map((j, i) => (
          <li key={j.id} className="flex items-start gap-2.5">
            <span
              className="text-[11px] font-semibold text-muted-foreground w-5 shrink-0 tabular-nums pt-0.5"
              aria-hidden
            >
              {i + 1}.
            </span>
            <Link
              href={`/journals/${j.slug}-${j.id}`}
              className="flex-1 min-w-0 text-sm font-medium text-foreground/90 hover:text-primary transition-colors leading-snug line-clamp-2 no-underline"
            >
              {j.title_tr ?? 'Başlıksız'}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/journals"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <BookOpen className="h-3 w-3" aria-hidden />
        Tüm dergiler
      </Link>
    </section>
  )
}
