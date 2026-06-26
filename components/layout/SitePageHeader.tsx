import { cn } from '@/lib/utils'

type SitePageHeaderProps = {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function SitePageHeader({
  title,
  description,
  className,
  children,
}: SitePageHeaderProps) {
  return (
    <header className={cn('site-page-header', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-[1.75rem] font-semibold text-foreground tracking-tight text-balance">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </header>
  )
}
