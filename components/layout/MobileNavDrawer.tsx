'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SearchBar } from '@/components/search/SearchBar'
import type { PublicAuthState } from '@/lib/auth/public-session'
import { buttonVariants } from '@/lib/utils'
import { cn } from '@/lib/utils'

const NAV_ID = 'mobile-nav-drawer'

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  showSearch: boolean
  showAuth?: boolean
  initialAuth?: PublicAuthState
}

export function MobileNavDrawer({
  open,
  onOpenChange,
  showSearch,
  showAuth = false,
  initialAuth,
}: MobileNavDrawerProps) {
  const pathname = usePathname()

  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id={NAV_ID}
        side="right"
        className="w-[min(100%,280px)] p-0 gap-0"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-base font-serif font-bold text-primary">Menü</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col px-2 py-3" aria-label="Mobil menü">
          {showSearch && (
            <div className="px-1 pb-3 mb-1 border-b border-border">
              <SearchBar variant="compact" placeholder="Ara…" />
            </div>
          )}
          <MobileNavLink href="/journals" active={pathname.startsWith('/journals')} onNavigate={close}>
            Dergiler
          </MobileNavLink>
          <MobileNavLink
            href="/search?type=article"
            active={pathname === '/search'}
            onNavigate={close}
          >
            Makaleler
          </MobileNavLink>
          <MobileNavLink href="/search?type=author" onNavigate={close}>
            Yazarlar
          </MobileNavLink>
          <MobileNavLink href="/istatistikler" active={pathname === '/istatistikler'} onNavigate={close}>
            İstatistikler
          </MobileNavLink>
          {showAuth && initialAuth !== undefined && (
            <div className="mt-2 pt-2 border-t border-border space-y-1">
              {initialAuth.authenticated ? (
                <>
                  <MobileNavLink href="/hesabim" onNavigate={close}>Hesabım</MobileNavLink>
                  <MobileNavLink href="/hesabim/kaydedilen" onNavigate={close}>Kaydettiklerim</MobileNavLink>
                  <MobileNavLink href="/hesabim/listeler" onNavigate={close}>Listelerim</MobileNavLink>
                  <MobileNavLink href="/profile" onNavigate={close}>Profilim</MobileNavLink>
                </>
              ) : (
                <>
                  <MobileNavLink href="/login" onNavigate={close}>Giriş Yap</MobileNavLink>
                  <Link
                    href="/register"
                    onClick={close}
                    className={cn(buttonVariants({ size: 'sm' }), 'w-full mt-2')}
                  >
                    Kayıt Ol
                  </Link>
                </>
              )}
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export const MOBILE_NAV_DRAWER_ID = NAV_ID

function MobileNavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string
  active?: boolean
  onNavigate: () => void
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`block px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'text-foreground bg-secondary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </Link>
  )
}
