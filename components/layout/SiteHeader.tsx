'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, buttonVariants } from '@/lib/utils'
import { SearchBar } from '@/components/search/SearchBar'

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="content-width">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 text-foreground hover:text-foreground"
          >
            <span className="font-serif text-xl font-bold tracking-tight text-primary">
              AcarIndex
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
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

          {/* Desktop arama + giriş */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-sm">
            <SearchBar variant="compact" className="flex-1" />
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
            >
              Giriş
            </Link>
          </div>

          {/* Mobil sağ alan */}
          <div className="flex md:hidden items-center gap-1">

            {/* Mobil menü toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menüyü aç/kapat"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobil menü */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-2">
            <div className="px-1 pb-2">
              <SearchBar variant="compact" placeholder="Ara…" />
            </div>
            <MobileNavLink href="/journals" onClick={() => setMobileMenuOpen(false)}>
              Dergiler
            </MobileNavLink>
            <MobileNavLink href="/search?type=article" onClick={() => setMobileMenuOpen(false)}>
              Makaleler
            </MobileNavLink>
            <MobileNavLink href="/search?type=author" onClick={() => setMobileMenuOpen(false)}>
              Yazarlar
            </MobileNavLink>
            <MobileNavLink href="/istatistikler" onClick={() => setMobileMenuOpen(false)}>
              İstatistikler
            </MobileNavLink>
            <div className="pt-2 border-t border-border mt-2">
              <MobileNavLink href="/login" onClick={() => setMobileMenuOpen(false)}>
                Giriş Yap
              </MobileNavLink>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-2 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      {children}
    </Link>
  )
}
