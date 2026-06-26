'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useRef, useState } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import {
  MobileNavDrawer,
  MOBILE_NAV_DRAWER_ID,
} from '@/components/layout/MobileNavDrawer'
import { HeaderAuthNav, HeaderAuthSkeleton } from '@/components/layout/HeaderAuthNav'
import type { PublicAuthState } from '@/lib/auth/public-session'

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
  const isHome = pathname === '/'

  const handleMenuOpenChange = (open: boolean) => {
    setMobileMenuOpen(open)
    if (!open) {
      requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
  }

  const authReady = !showAuth || initialAuth !== undefined

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="content-width">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 text-foreground hover:text-foreground"
          >
            <span className="font-serif text-[1.5rem] font-bold tracking-tight text-primary leading-none">
              AcarIndex
            </span>
          </Link>

          <nav
            className="hidden lg:flex items-center gap-6 text-[0.9375rem] font-semibold"
            aria-label="Ana menü"
          >
            <Link
              href="/journals"
              className="text-foreground/85 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Dergiler
            </Link>
            <Link
              href="/search?type=article"
              className="text-foreground/85 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Makaleler
            </Link>
            <Link
              href="/search?type=author"
              className="text-foreground/85 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Yazarlar
            </Link>
            <Link
              href="/istatistikler"
              className="text-foreground/85 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              İstatistikler
            </Link>
          </nav>

          <div className="hidden lg:flex items-center gap-3 flex-1 max-w-sm justify-end min-w-0">
            {!isHome && <SearchBar variant="compact" className="flex-1 max-w-xs min-w-0" />}
            {showAuth && (
              authReady && initialAuth
                ? <HeaderAuthNav initialAuth={initialAuth} />
                : <HeaderAuthSkeleton />
            )}
          </div>

          <div className="flex lg:hidden items-center gap-1 shrink-0">
            {showAuth && authReady && initialAuth && (
              <HeaderAuthNav initialAuth={initialAuth} compact />
            )}
            {showAuth && !authReady && <HeaderAuthSkeleton compact />}
            <button
              ref={menuButtonRef}
              type="button"
              className="inline-flex lg:hidden items-center justify-center h-10 w-10 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
