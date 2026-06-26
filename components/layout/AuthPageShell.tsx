import { BrandWordmark } from '@/components/layout/BrandWordmark'
import { cn } from '@/lib/utils'

type AuthPageShellProps = {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function AuthPageShell({
  title,
  description,
  children,
  className,
}: AuthPageShellProps) {
  return (
    <div className="auth-page-shell">
      <div className={cn('auth-page-card', className)}>
        <div className="mb-6 text-center">
          <BrandWordmark asLink />
          <h1 className="mt-4 font-serif text-xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
