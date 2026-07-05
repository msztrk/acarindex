'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUi } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

export function HesabimNav() {
  const { m, lp } = useUi()
  const pathname = usePathname()

  const tabs = [
    { href: lp('/hesabim'), label: m.account.overview, exact: true },
    { href: lp('/hesabim/kaydedilen'), label: m.account.savedArticles },
    { href: lp('/hesabim/listeler'), label: m.account.readingLists },
    { href: lp('/hesabim/takip-dergiler'), label: m.account.followedJournals },
    { href: lp('/hesabim/takip-yazarlar'), label: m.account.followedAuthors },
    { href: lp('/hesabim/son-goruntulenen'), label: m.account.recentViews },
    { href: lp('/hesabim/basvurular'), label: m.account.applications },
    { href: lp('/hesabim/bildirimler'), label: m.account.notifications },
    { href: lp('/hesabim/security'), label: m.account.security },
  ]

  return (
    <nav
      className={cn(
        'flex flex-col gap-1',
        'sm:flex-row sm:flex-wrap sm:gap-2 sm:border-b sm:border-border sm:pb-3',
        'lg:flex-col lg:flex-nowrap lg:gap-1 lg:border-b-0 lg:border-r lg:border-border lg:pr-4 lg:pb-0',
        'lg:sticky lg:top-24 lg:self-start',
      )}
      aria-label={m.account.navLabel}
    >
      {tabs.map((tab) => {
        const pathWithoutLocale = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
        const hrefWithoutLocale = tab.href.replace(/^\/en(?=\/|$)/, '') || '/'
        const active = tab.exact
          ? pathWithoutLocale === hrefWithoutLocale
          : pathWithoutLocale === hrefWithoutLocale ||
            pathWithoutLocale.startsWith(`${hrefWithoutLocale}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-md px-3 py-2 text-[0.9375rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
