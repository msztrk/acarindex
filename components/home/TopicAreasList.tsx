'use client'

import Link from 'next/link'
import { useUi } from '@/components/i18n/LocaleProvider'
import { pickLocalizedTitle } from '@/lib/seo/hreflang'

export interface TopicAreaItem {
  id: number
  name_tr: string | null
  name_en: string | null
}

export function TopicAreasList({ categories }: { categories: TopicAreaItem[] }) {
  const { m, lp, locale } = useUi()

  if (categories.length === 0) return null

  return (
    <section className="mt-4 rounded-xl bg-transparent lg:mt-5 lg:border lg:border-border/80 lg:bg-surface lg:p-5 lg:shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-foreground lg:mb-3">{m.home.topicAreas}</h2>
      <ul className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const label =
            pickLocalizedTitle(cat.name_tr, cat.name_en, locale) ||
            (locale === 'en' ? 'Category' : 'Kategori')
          return (
            <li key={cat.id} className="min-w-0 max-w-full">
              <Link
                href={lp(`/journals?category=${cat.id}`)}
                title={label}
                className="inline-flex max-w-full items-center rounded-full border border-brand-accent/25 bg-brand-accent/8 px-3 py-1.5 text-[0.9375rem] font-medium text-brand-primary no-underline transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="line-clamp-2 sm:line-clamp-1">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
