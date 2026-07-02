'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SiteLocale } from '@/lib/i18n/locale'

export function LocaleSwitcher({ className }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [alternates, setAlternates] = useState<{ tr: string; en: string | null; current: SiteLocale } | null>(
    null,
  )

  useEffect(() => {
    const qs = searchParams.toString()
    const path = qs ? `${pathname}?${qs}` : pathname
    fetch(`/api/locale/alternate?path=${encodeURIComponent(path.split('?')[0] ?? '/')}`)
      .then((r) => r.json())
      .then(setAlternates)
      .catch(() => setAlternates(null))
  }, [pathname, searchParams])

  const current = alternates?.current ?? (pathname.startsWith('/en') ? 'en' : 'tr')
  const trHref = alternates?.tr ?? '/'
  const enHref = alternates?.en

  const linkClass = (active: boolean) =>
    cn(
      'px-2 py-1 text-xs font-semibold rounded-md border transition-colors no-underline',
      active
        ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
        : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/20',
    )

  return (
    <div className={cn('flex items-center gap-1', className)} aria-label="Dil seçimi">
      <Link href={trHref} className={linkClass(current === 'tr')} hrefLang="tr">
        TR
      </Link>
      {enHref ? (
        <Link href={enHref} className={linkClass(current === 'en')} hrefLang="en">
          EN
        </Link>
      ) : (
        <span className={cn(linkClass(false), 'opacity-40 cursor-not-allowed')} aria-disabled>
          EN
        </span>
      )}
    </div>
  )
}
