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
      className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-2 border-b border-border pb-3 mb-6"
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
