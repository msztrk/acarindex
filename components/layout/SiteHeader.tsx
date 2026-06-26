'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useRef, useState } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import {
  MobileNavDrawer,
  MOBILE_NAV_DRAWER_ID,
} from '@/components/layout/MobileNavDrawer'
import { HeaderAuthNav, HeaderAuthSkeleton } from '@/components/layout/HeaderAuthNav'
import { BrandWordmark } from '@/components/layout/BrandWordmark'
import type { PublicAuthState } from '@/lib/auth/public-session'
import { cn } from '@/lib/utils'

type NavLink = {
  href: string
  label: string
  match: (pathname: string, searchType: string | null) => boolean
}

const NAV_LINKS: NavLink[] = [
  {
    href: '/journals',
    label: 'Dergiler',
    match: (p) => p.startsWith('/journals'),
  },
  {
    href: '/search?type=article',
    label: 'Makaleler',
    match: (p, type) => p === '/search' && (type === 'article' || type === null),
  },
  {
    href: '/search?type=author',
    label: 'Yazarlar',
    match: (p, type) => p === '/search' && type === 'author',
  },
  {
    href: '/istatistikler',
    label: 'İstatistikler',
    match: (p) => p === '/istatistikler',
  },
]

export function SiteHeader({
  showAuth = false,
  initialAuth,
}: {
  showAuth?: boolean
  initialAuth?: PublicAuthState
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchType = searchParams.get('type')
  const isHome = pathname === '/'

  const handleMenuOpenChange = (open: boolean) => {
    setMobileMenuOpen(open)
    if (!open) {
      requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
  }

  const authReady = !showAuth || initialAuth !== undefined

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/70 bg-surface/95 shadow-[0_1px_0_0_rgba(15,23,42,0.03)] backdrop-blur-sm supports-[backdrop-filter]:bg-surface/92"
    >
      <div className="content-width">
        <div className="flex h-[3.75rem] sm:h-16 items-center justify-between gap-2 sm:gap-3 min-w-0">
          <BrandWordmark variant="compact" className="shrink-0" />

          <nav
            className="hidden lg:flex items-center gap-1 text-[0.9375rem] font-semibold"
            aria-label="Ana menü"
          >
            {NAV_LINKS.map((item) => {
              const active = item.match(pathname, searchType)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline',
                    active
                      ? 'text-brand-primary font-semibold'
                      : 'text-text-soft hover:text-brand-primary hover:bg-brand-primary/5',
                  )}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-teal-500"
                      aria-hidden
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-3 flex-1 max-w-lg justify-end min-w-0">
            {!isHome && <SearchBar variant="compact" className="flex-1 max-w-sm min-w-0" />}
            {showAuth && (
              authReady && initialAuth
                ? <HeaderAuthNav initialAuth={initialAuth} />
                : <HeaderAuthSkeleton />
            )}
          </div>

          <div className="flex lg:hidden items-center gap-1 shrink-0 min-w-0">
            {showAuth && authReady && initialAuth && (
              <HeaderAuthNav initialAuth={initialAuth} compact />
            )}
            {showAuth && !authReady && <HeaderAuthSkeleton compact />}
            <button
              ref={menuButtonRef}
              type="button"
              className="inline-flex lg:hidden shrink-0 items-center justify-center h-10 w-10 rounded-lg text-foreground/80 hover:bg-brand-primary/8 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => handleMenuOpenChange(true)}
              aria-expanded={mobileMenuOpen}
              aria-controls={MOBILE_NAV_DRAWER_ID}
              aria-haspopup="dialog"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <MobileNavDrawer
        open={mobileMenuOpen}
        onOpenChange={handleMenuOpenChange}
        showSearch={!isHome}
        showAuth={showAuth}
        initialAuth={initialAuth}
      />
    </header>
  )
}
