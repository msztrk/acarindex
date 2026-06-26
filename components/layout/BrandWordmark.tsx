import Link from 'next/link'
import { cn } from '@/lib/utils'

type BrandWordmarkProps = {
  className?: string
  variant?: 'default' | 'compact' | 'footer'
  asLink?: boolean
}

/**
 * Tipografik AcarIndex wordmark. Nihai vektörel sembol logo ayrı çalışma olarak gelecek.
 */
export function BrandWordmark({
  className,
  variant = 'default',
  asLink = true,
}: BrandWordmarkProps) {
  const isCompact = variant === 'compact'
  const isFooter = variant === 'footer'

  const content = (
    <span className={cn('inline-flex min-w-0 flex-col leading-none', className)}>
      <span
        className={cn(
          'font-serif font-bold tracking-tight text-brand-900',
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
