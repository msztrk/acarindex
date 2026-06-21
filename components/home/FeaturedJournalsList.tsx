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
        <h2 className="text-[0.9375rem] font-semibold text-foreground mb-1">Öne çıkan dergiler</h2>
        <p className="text-[0.8125rem] text-muted-foreground py-2">
          Öne çıkan dergi listesi henüz hazır değil.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-[0.9375rem] font-semibold text-foreground mb-1">Öne çıkan dergiler</h2>
      <p className="text-[0.8125rem] text-foreground/65 mb-3">Sayfa görüntülenmesine göre</p>
      <ol className="space-y-3.5">
        {journals.map((j, i) => (
          <li key={j.id} className="flex items-start gap-2">
            <span
              className="text-xs font-semibold text-foreground/50 w-5 shrink-0 tabular-nums leading-snug pt-0.5"
              aria-hidden
            >
              {i + 1}.
            </span>
            <Link
              href={`/journals/${j.slug}-${j.id}`}
              title={j.title_tr ?? undefined}
              className="flex-1 min-w-0 text-[0.9375rem] font-medium text-foreground/90 hover:text-primary hover:underline underline-offset-2 transition-colors leading-snug line-clamp-2 no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {j.title_tr ?? 'Başlıksız'}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/journals"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Tüm dergiler
      </Link>
    </section>
  )
}
