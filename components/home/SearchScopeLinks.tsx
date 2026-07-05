'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useUi } from '@/components/i18n/LocaleProvider'

export function SearchScopeLinks({ className }: { className?: string }) {
  const { m, lp } = useUi()

  const scopeLinks = [
    { label: m.home.scopeAll, href: lp('/search') },
    { label: m.home.scopeArticles, href: lp('/search?type=article') },
    { label: m.home.scopeAuthors, href: lp('/search?type=author') },
    { label: m.home.scopeJournals, href: lp('/journals') },
  ]

  return (
    <nav
      className={cn(
        '-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden',
        className,
      )}
      aria-label={m.search.search}
    >
      {scopeLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'type-filter-option inline-flex min-h-8 shrink-0 items-center rounded-full px-2.5 py-1 font-medium no-underline transition-colors sm:px-3',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            item.label === m.home.scopeAll
              ? 'bg-brand-primary/10 text-brand-primary font-semibold'
              : 'text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/5',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
