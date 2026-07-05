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
          <h1 className="type-page-heading break-words">
            {title}
          </h1>
          {description && (
            <p className="type-section-desc mt-1.5 max-w-3xl">
              {description}
            </p>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </header>
  )
}
