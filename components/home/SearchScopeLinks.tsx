import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Yalnızca mevcut çalışan route'lar — sahte veya işlevsiz kontrol yok */
const SCOPE_LINKS = [
  { label: 'Tümü', href: '/search' },
  { label: 'Makaleler', href: '/search?type=article' },
  { label: 'Yazarlar', href: '/search?type=author' },
  { label: 'Dergiler', href: '/journals' },
] as const

export function SearchScopeLinks({ className }: { className?: string }) {
  return (
    <nav
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      aria-label="Arama kapsamı"
    >
      {SCOPE_LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-full px-3 py-1 text-[0.8125rem] font-medium no-underline transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            item.label === 'Tümü'
              ? 'bg-brand-primary/10 text-brand-primary font-semibold'
              : 'text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/5',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
