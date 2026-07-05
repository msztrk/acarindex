'use client'

import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { POPULAR_SEARCHES } from '@/lib/home/popular-searches'
import { cn } from '@/lib/utils'
import { useUi } from '@/components/i18n/LocaleProvider'

export function PopularSearchesCard({ className }: { className?: string }) {
  const { m } = useUi()

  return (
    <div className={cn('home-surface-card', className)} data-d2-popular-searches>
      <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
        <TrendingUp className="h-4 w-4 text-brand-accent shrink-0" aria-hidden />
        <h2 className="type-card-title">
          {m.home.popularSearches}
        </h2>
      </div>
      <ul className="flex flex-wrap gap-1.5 lg:block lg:space-y-1">
        {POPULAR_SEARCHES.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="type-filter-option inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border/70 bg-surface-soft/70 px-2.5 py-1 font-medium text-foreground/85 transition-colors no-underline hover:border-brand-accent/35 hover:bg-brand-primary/5 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:flex lg:border-0 lg:bg-transparent lg:px-2 lg:py-1.5 lg:text-base lg:font-normal"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent/70"
                aria-hidden
              />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
