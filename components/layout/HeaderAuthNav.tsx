'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, buttonVariants } from '@/lib/utils'
import {
  displayNameFromUser,
  initialsFromUser,
  type PublicAuthState,
  type PublicSessionUser,
} from '@/lib/auth/public-session'
import { fetchCsrfToken } from '@/lib/auth/csrf-client'

const MENU_LINKS = [
  { href: '/hesabim', label: 'Hesabım' },
  { href: '/hesabim/kaydedilen', label: 'Kaydettiklerim' },
  { href: '/hesabim/listeler', label: 'Listelerim' },
  { href: '/profile', label: 'Profilim' },
] as const

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
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  if (!initialAuth.authenticated || !initialAuth.user) {
    return (
      <div className={cn('flex items-center gap-2 shrink-0', compact && 'flex-row gap-1')}>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'border-foreground/30 text-foreground font-semibold hover:bg-secondary hover:border-foreground/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            compact && 'px-2.5',
          )}
        >
          Giriş
        </Link>
        <Link
          href="/register"
          className={cn(
            buttonVariants({ size: 'sm' }),
            compact && 'px-2.5',
          )}
        >
          Kayıt Ol
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
      window.location.href = '/'
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground',
          'hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          compact && 'w-full justify-start px-3 py-2.5',
        )}
        aria-label="Hesap menüsü"
      >
        <UserAvatar user={user} className="h-8 w-8 text-xs" />
        <span className="max-w-[9rem] truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <nav className="flex flex-col" aria-label="Kullanıcı menüsü">
          {MENU_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {loggingOut ? 'Çıkış…' : 'Çıkış Yap'}
          </button>
        </nav>
      </PopoverContent>
    </Popover>
  )
}

export function HeaderAuthSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn('flex items-center gap-2', compact && 'w-full')}
      aria-busy="true"
      aria-label="Oturum yükleniyor"
    >
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
      {!compact && <div className="h-4 w-20 rounded bg-muted animate-pulse" />}
    </div>
  )
}
