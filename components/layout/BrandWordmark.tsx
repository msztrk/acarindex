import Link from 'next/link'
import { cn } from '@/lib/utils'

type BrandWordmarkProps = {
  className?: string
  /** compact: yalnızca monogram + kısa marka (mobil header) */
  variant?: 'default' | 'compact' | 'footer'
  asLink?: boolean
}

/**
 * Tipografik AcarIndex markası. Gelecekte raster logo yerine kullanılabilecek monogram slotu.
 */
export function BrandWordmark({
  className,
  variant = 'default',
  asLink = true,
}: BrandWordmarkProps) {
  const isCompact = variant === 'compact'
  const isFooter = variant === 'footer'

  const content = (
    <span className={cn('inline-flex items-center gap-2.5 min-w-0', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-primary-foreground',
          'bg-gradient-to-br from-brand-primary to-brand-secondary shadow-sm',
          isCompact ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm',
        )}
        aria-hidden
      >
        AI
      </span>
      <span className="flex flex-col min-w-0 leading-none">
        <span
          className={cn(
            'font-serif font-bold tracking-tight text-brand-primary',
            isCompact ? 'text-lg' : isFooter ? 'text-xl' : 'text-[1.375rem]',
          )}
        >
          AcarIndex
        </span>
        {!isCompact && (
          <span className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Akademik indeks
          </span>
        )}
      </span>
    </span>
  )

  if (!asLink) return content

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 rounded-sm text-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  )
}
