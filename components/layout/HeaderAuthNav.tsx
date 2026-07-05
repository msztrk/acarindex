'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, buttonVariants } from '@/lib/utils'
import { useUi } from '@/components/i18n/LocaleProvider'
import {
  displayNameFromUser,
  initialsFromUser,
  type PublicAuthState,
  type PublicSessionUser,
} from '@/lib/auth/public-session'
import { fetchCsrfToken } from '@/lib/auth/csrf-client'

function UserAvatar({ user, className }: { user: PublicSessionUser; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold shrink-0',
        className,
      )}
      aria-hidden
    >
      {initialsFromUser(user)}
    </span>
  )
}

export function HeaderAuthNav({
  initialAuth,
  compact = false,
}: {
  initialAuth: PublicAuthState
  compact?: boolean
}) {
  const { m, lp } = useUi()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const menuLinks = [
    { href: lp('/hesabim'), label: m.auth.myAccount },
    { href: lp('/hesabim/kaydedilen'), label: m.auth.saved },
    { href: lp('/hesabim/listeler'), label: m.auth.lists },
    { href: lp('/profile'), label: m.auth.profile },
  ] as const

  if (!initialAuth.authenticated || !initialAuth.user) {
    return (
      <div className={cn('flex items-center gap-2 shrink-0', compact && 'flex-row gap-1')}>
        <Link
          href={lp('/login')}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'border-foreground/30 text-foreground font-semibold hover:bg-secondary hover:border-foreground/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            compact && 'px-2.5',
          )}
        >
          {m.auth.login}
        </Link>
        <Link
          href={lp('/register')}
          className={cn(buttonVariants({ size: 'sm' }), compact && 'px-2.5')}
        >
          {m.auth.register}
        </Link>
      </div>
    )
  }

  const user = initialAuth.user
  const label = displayNameFromUser(user)

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const token = await fetchCsrfToken()
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': token },
      })
      window.location.href = lp('/')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.9375rem] font-medium text-foreground',
          'hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          compact && 'shrink-0 gap-1.5 px-1.5 py-1.5',
        )}
        aria-label={m.auth.accountMenu}
      >
        <UserAvatar user={user} className="h-8 w-8 text-xs" />
        <span className={cn('max-w-[9rem] truncate', compact && 'sr-only')}>{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <nav className="flex flex-col" aria-label={m.auth.userMenu}>
          {menuLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-[0.9375rem] text-foreground hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[0.9375rem] text-foreground hover:bg-muted transition-colors text-left w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {loggingOut ? m.auth.loggingOut : m.auth.logout}
          </button>
        </nav>
      </PopoverContent>
    </Popover>
  )
}

export function HeaderAuthSkeleton({ compact = false }: { compact?: boolean }) {
  const { m } = useUi()
  return (
    <div
      className={cn('h-9 w-24 rounded-md bg-muted animate-pulse shrink-0', compact && 'w-9')}
      aria-label={m.auth.loadingSession}
      role="status"
    />
  )
}
