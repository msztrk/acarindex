import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { POPULAR_SEARCHES } from '@/lib/home/popular-searches'
import { cn } from '@/lib/utils'

export function PopularSearchesCard({ className }: { className?: string }) {
  return (
    <div className={cn('home-surface-card p-4 sm:p-5', className)}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-brand-accent shrink-0" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Popüler aramalar</h2>
      </div>
      <ul className="space-y-1">
        {POPULAR_SEARCHES.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.9375rem] text-foreground/85 hover:text-brand-primary hover:bg-brand-primary/5 transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
