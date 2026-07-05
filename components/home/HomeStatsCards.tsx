'use client'

import Link from 'next/link'
import { BookOpen, FileText, Files, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUi } from '@/components/i18n/LocaleProvider'

function fmt(n: number | null, locale: string): string {
  if (!n) return '—'
  return n.toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR')
}

type StatItem = {
  label: string
  value: string
  icon: LucideIcon
  href?: string
}

export function HomeStatsCards({
  journalCount,
  articleCount,
  pdfCount,
  approxNote,
}: {
  journalCount: number | null
  articleCount: number | null
  pdfCount: number | null
  approxNote: string
}) {
  const { m, lp, locale } = useUi()

  const items: StatItem[] = [
    {
      label: m.home.journals,
      value: fmt(journalCount, locale),
      href: lp('/journals'),
      icon: BookOpen,
    },
    {
      label: m.home.articles,
      value: fmt(articleCount, locale),
      href: lp('/search?type=article'),
      icon: FileText,
    },
    {
      label: m.home.fullText,
      value: fmt(pdfCount, locale),
      icon: Files,
    },
  ]

  const itemClass =
    'home-stat-card flex items-center justify-center gap-1.5 px-2 py-2 transition-colors sm:justify-start sm:gap-2.5 sm:px-3.5 sm:py-3'

  return (
    <div className="mt-3 md:mt-6">
      <div
        className="grid max-w-xl grid-cols-3 divide-x divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        role="list"
      >
        {items.map((item) => {
          const Icon = item.icon
          const inner = (
            <>
              <Icon className="h-4 w-4 shrink-0 text-brand-accent sm:h-4 sm:w-4" aria-hidden />
              <div className="min-w-0">
                <p className="type-stat-value">
                  {item.value}
                </p>
                <p className="type-stat-label mt-0.5 sm:mt-1">
                  {item.label}
                </p>
              </div>
            </>
          )

          if (!item.href) {
            return (
              <div key={item.label} className={itemClass} role="listitem">
                {inner}
              </div>
            )
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                itemClass,
                'hover:bg-brand-accent/5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              role="listitem"
            >
              {inner}
            </Link>
          )
        })}
      </div>
      <p className="type-card-meta mt-1.5 text-center sm:mt-2 sm:text-left">
        ({approxNote})
      </p>
    </div>
  )
}
