'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/hesabim', label: 'Genel Bakış', exact: true },
  { href: '/hesabim/kaydedilen', label: 'Kaydedilen Makaleler' },
  { href: '/hesabim/listeler', label: 'Okuma Listelerim' },
  { href: '/hesabim/takip-dergiler', label: 'Takip Ettiğim Dergiler' },
  { href: '/hesabim/takip-yazarlar', label: 'Takip Ettiğim Yazarlar' },
  { href: '/hesabim/son-goruntulenen', label: 'Son Görüntülediklerim' },
  { href: '/hesabim/bildirimler', label: 'Bildirim Tercihleri' },
  { href: '/hesabim/security', label: 'Güvenlik' },
]

export function HesabimNav() {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'flex flex-col gap-1',
        'sm:flex-row sm:flex-wrap sm:gap-2 sm:border-b sm:border-border sm:pb-3',
        'lg:flex-col lg:flex-nowrap lg:gap-1 lg:border-b-0 lg:border-r lg:border-border lg:pr-4 lg:pb-0',
        'lg:sticky lg:top-24 lg:self-start',
      )}
      aria-label="Hesap menüsü"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'bg-primary text-primary-foreground'
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
