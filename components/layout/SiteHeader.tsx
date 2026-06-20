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

export function SiteHeader() {
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
            <span className="font-serif text-xl font-bold tracking-tight text-primary">
              AcarIndex
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Ana menü">
            <Link href="/journals" className="text-muted-foreground hover:text-foreground transition-colors">
              Dergiler
            </Link>
            <Link href="/search?type=article" className="text-muted-foreground hover:text-foreground transition-colors">
              Makaleler
            </Link>
            <Link href="/search?type=author" className="text-muted-foreground hover:text-foreground transition-colors">
              Yazarlar
            </Link>
            <Link href="/istatistikler" className="text-muted-foreground hover:text-foreground transition-colors">
              İstatistikler
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3 flex-1 max-w-sm justify-end">
            {!isHome && <SearchBar variant="compact" className="flex-1 max-w-xs" />}
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
            >
              Giriş
            </Link>
          </div>

          <div className="flex md:hidden items-center">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="md:hidden"
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
      />
    </header>
  )
}
