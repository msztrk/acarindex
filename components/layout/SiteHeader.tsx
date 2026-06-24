'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, buttonVariants } from '@/lib/utils'
import { SearchBar } from '@/components/search/SearchBar'
import {
  MobileNavDrawer,
  MOBILE_NAV_DRAWER_ID,
} from '@/components/layout/MobileNavDrawer'

export function SiteHeader({ showAuth = false }: { showAuth?: boolean }) {
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

          <nav className="hidden lg:flex items-center gap-6 text-[0.9375rem] font-semibold" aria-label="Ana menü">
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

          <div className="hidden lg:flex items-center gap-3 flex-1 max-w-sm justify-end">
            {!isHome && <SearchBar variant="compact" className="flex-1 max-w-xs" />}
            {showAuth && (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'shrink-0 border-foreground/30 text-foreground font-semibold hover:bg-secondary hover:border-foreground/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              Giriş
            </Link>
            )}
          </div>

          <div className="flex lg:hidden items-center">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => handleMenuOpenChange(true)}
              aria-expanded={mobileMenuOpen}
              aria-controls={MOBILE_NAV_DRAWER_ID}
              aria-haspopup="dialog"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <MobileNavDrawer
        open={mobileMenuOpen}
        onOpenChange={handleMenuOpenChange}
        showSearch={!isHome}
        showAuth={showAuth}
      />
    </header>
  )
}
