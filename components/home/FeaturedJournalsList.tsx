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
        <h2 className="text-sm font-semibold text-foreground mb-3">Öne çıkan dergiler</h2>
        <p className="text-sm text-muted-foreground py-2">
          Öne çıkan dergi listesi henüz hazır değil.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-3">Öne çıkan dergiler</h2>
      <p className="text-xs text-muted-foreground mb-3">Sayfa görüntülenmesine göre</p>
      <ol className="space-y-2">
        {journals.map((j, i) => (
          <li key={j.id} className="flex items-start gap-2 text-sm">
            <span className="text-xs text-muted-foreground w-4 shrink-0 tabular-nums">{i + 1}.</span>
            <Link
              href={`/journals/${j.slug}-${j.id}`}
              className="flex-1 min-w-0 text-foreground hover:text-primary transition-colors leading-snug line-clamp-2 no-underline"
            >
              {j.title_tr ?? 'Başlıksız'}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/journals"
        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <BookOpen className="h-3 w-3" />
        Tüm dergiler
      </Link>
    </section>
  )
}
