import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CatalogEmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
  variant?: 'panel' | 'inline'
}

export function CatalogEmptyState({
  icon: Icon,
  title,
  description,
  className = '',
  variant = 'panel',
}: CatalogEmptyStateProps) {
  return (
    <div
      className={cn(
        variant === 'panel' ? 'catalog-empty-panel' : 'py-10 text-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <Icon
          className="mx-auto mb-3 h-9 w-9 text-brand-accent/60"
          aria-hidden="true"
        />
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-2 mx-auto max-w-md text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
