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
import { useUi } from '@/components/i18n/LocaleProvider'
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
  const { m, lp } = useUi()
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
          <SheetTitle className="text-base font-serif font-bold text-primary">
            {m.nav.menu}
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col px-2 py-3" aria-label={m.nav.mobileMenu}>
          {showSearch && (
            <div className="px-1 pb-3 mb-1 border-b border-border">
              <SearchBar variant="compact" />
            </div>
          )}
          <MobileNavLink href={lp('/journals')} active={pathname.startsWith('/journals')} onNavigate={close}>
            {m.nav.journals}
          </MobileNavLink>
          <MobileNavLink
            href={lp('/search?type=article')}
            active={pathname === '/search'}
            onNavigate={close}
          >
            {m.nav.articles}
          </MobileNavLink>
          <MobileNavLink href={lp('/search?type=author')} onNavigate={close}>
            {m.nav.authors}
          </MobileNavLink>
          <MobileNavLink href={lp('/istatistikler')} active={pathname === '/istatistikler'} onNavigate={close}>
            {m.nav.statistics}
          </MobileNavLink>
          {showAuth && initialAuth !== undefined && (
            <div className="mt-2 pt-2 border-t border-border space-y-1">
              {initialAuth.authenticated ? (
                <>
                  <MobileNavLink href={lp('/hesabim')} onNavigate={close}>{m.auth.myAccount}</MobileNavLink>
                  <MobileNavLink href={lp('/hesabim/kaydedilen')} onNavigate={close}>{m.auth.saved}</MobileNavLink>
                  <MobileNavLink href={lp('/hesabim/listeler')} onNavigate={close}>{m.auth.lists}</MobileNavLink>
                  <MobileNavLink href={lp('/profile')} onNavigate={close}>{m.auth.profile}</MobileNavLink>
                </>
              ) : (
                <>
                  <MobileNavLink href={lp('/login')} onNavigate={close}>{m.auth.loginFull}</MobileNavLink>
                  <Link
                    href={lp('/register')}
                    onClick={close}
                    className={cn(buttonVariants({ size: 'sm' }), 'w-full mt-2')}
                  >
                    {m.auth.register}
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
      className={cn(
        'flex min-h-[44px] items-center px-3 py-2.5 text-base font-medium rounded-md transition-colors',
        active
          ? 'text-foreground bg-secondary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
      )}
    >
      {children}
    </Link>
  )
}
