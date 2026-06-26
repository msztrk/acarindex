import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      <section className="home-surface-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Öne çıkan dergiler</h2>
        <p className="text-[0.8125rem] text-muted-foreground py-1">
          Öne çıkan dergi listesi henüz hazır değil.
        </p>
      </section>
    )
  }

  return (
    <section className="home-surface-card p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Öne çıkan dergiler</h2>
        <p className="text-[0.75rem] text-muted-foreground mt-0.5">Sayfa görüntülenmesine göre</p>
      </div>
      <ol className="space-y-2.5">
        {journals.map((j, i) => (
          <li key={j.id} className="flex items-start gap-2.5 rounded-lg px-1 py-0.5 hover:bg-brand-primary/5 transition-colors">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-primary/10 text-[0.6875rem] font-bold tabular-nums text-brand-primary"
              aria-hidden
            >
              {i + 1}
            </span>
            <Link
              href={`/journals/${j.slug}-${j.id}`}
              title={j.title_tr ?? undefined}
              className="flex-1 min-w-0 text-[0.9375rem] font-medium text-foreground/90 hover:text-brand-primary transition-colors leading-snug line-clamp-2 no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {j.title_tr ?? 'Başlıksız'}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/journals"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-secondary hover:text-brand-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Tüm dergiler
      </Link>
    </section>
  )
}
