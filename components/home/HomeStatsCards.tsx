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

  const cardClass =
    'home-stat-card flex items-center gap-2.5 rounded-xl border border-border/80 bg-surface/90 px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-sm transition-colors'

  return (
    <div className="mt-5 md:mt-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xl" role="list">
        {items.map((item) => {
          const Icon = item.icon
          const inner = (
            <>
              <Icon className="h-4 w-4 text-brand-accent shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="tabular-nums text-lg sm:text-xl font-semibold text-brand-primary leading-none">
                  {item.value}
                </p>
                <p className="mt-1 text-[0.6875rem] sm:text-xs text-muted-foreground font-medium">
                  {item.label}
                </p>
              </div>
            </>
          )

          if (!item.href) {
            return (
              <div key={item.label} className={cardClass} role="listitem">
                {inner}
              </div>
            )
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                cardClass,
                'hover:border-brand-accent/35 hover:bg-brand-accent/5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              role="listitem"
            >
              {inner}
            </Link>
          )
        })}
      </div>
      <p className="mt-2 text-[0.6875rem] text-muted-foreground text-center sm:text-left">
        ({approxNote})
      </p>
    </div>
  )
}
