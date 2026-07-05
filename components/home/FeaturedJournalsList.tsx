'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUi } from '@/components/i18n/LocaleProvider'
import { pickLocalizedTitle } from '@/lib/seo/hreflang'

export interface FeaturedJournalItem {
  id: number
  slug: string
  title_tr: string | null
  title_en?: string | null
  issn: string | null
  hit_count: number | null
}

export function FeaturedJournalsList({ journals }: { journals: FeaturedJournalItem[] }) {
  const { m, lp, locale } = useUi()

  if (journals.length === 0) {
    return (
      <section className="home-surface-card">
        <h2 className="type-card-title mb-1">{m.home.featuredJournals}</h2>
        <p className="type-card-body py-1">
          {locale === 'en' ? 'Featured journal list is not ready yet.' : 'Öne çıkan dergi listesi henüz hazır değil.'}
        </p>
      </section>
    )
  }

  return (
    <section className="home-surface-card">
      <div className="mb-3">
        <h2 className="type-card-title">{m.home.featuredJournals}</h2>
        <p className="type-card-meta mt-0.5">{m.home.featuredJournalsDesc}</p>
      </div>
      <ol className="space-y-2.5">
        {journals.map((j, i) => {
          const title =
            pickLocalizedTitle(j.title_tr, j.title_en, locale) || m.article.untitled
          return (
            <li
              key={j.id}
              className="flex items-start gap-2.5 rounded-lg px-1 py-0.5 hover:bg-brand-primary/5 transition-colors"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-primary/10 text-[0.8125rem] font-bold tabular-nums text-brand-primary"
                aria-hidden
              >
                {i + 1}
              </span>
              <Link
                href={lp(`/journals/${j.slug}-${j.id}`)}
                className={cn(
                  'type-journal-list-title min-w-0 hover:text-brand-primary no-underline line-clamp-2',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
                )}
                title={title}
              >
                {title}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
