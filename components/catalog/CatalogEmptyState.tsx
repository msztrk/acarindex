import type { LucideIcon } from 'lucide-react'

interface CatalogEmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
}

export function CatalogEmptyState({
  icon: Icon,
  title,
  description,
  className = '',
}: CatalogEmptyStateProps) {
  return (
    <div
      className={`py-16 text-center text-muted-foreground ${className}`}
      role="status"
      aria-live="polite"
    >
      {Icon && <Icon className="h-10 w-10 mx-auto mb-3 opacity-30" aria-hidden="true" />}
      <p className="font-medium text-foreground/80">{title}</p>
      {description && <p className="text-sm mt-2 max-w-md mx-auto">{description}</p>}
    </div>
  )
}
