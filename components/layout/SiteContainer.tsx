import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SiteContainerVariant = 'default' | 'wide'

const variantClass: Record<SiteContainerVariant, string> = {
  default: 'content-width',
  wide: 'content-width-wide',
}

export function SiteContainer({
  children,
  className,
  as: Tag = 'div',
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  as?: ElementType
  variant?: SiteContainerVariant
}) {
  return <Tag className={cn(variantClass[variant], className)}>{children}</Tag>
}
