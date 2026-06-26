import Link from 'next/link'
import { BookOpen, FileText, Files, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(n: number | null): string {
  if (!n) return '—'
  return n.toLocaleString('tr-TR')
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
  const items: StatItem[] = [
    { label: 'Dergi', value: fmt(journalCount), href: '/journals', icon: BookOpen },
    { label: 'Makale', value: fmt(articleCount), href: '/search?type=article', icon: FileText },
    { label: 'Tam metin', value: fmt(pdfCount), icon: Files },
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
              <Icon className="h-3.5 w-3.5 shrink-0 text-brand-accent sm:h-4 sm:w-4" aria-hidden />
              <div className="min-w-0">
                <p className="tabular-nums text-base font-semibold leading-none text-brand-primary sm:text-xl">
                  {item.value}
                </p>
                <p className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground sm:mt-1 sm:text-xs">
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
      <p className="mt-1.5 text-center text-[0.6875rem] text-muted-foreground sm:mt-2 sm:text-left">
        ({approxNote})
      </p>
    </div>
  )
}
