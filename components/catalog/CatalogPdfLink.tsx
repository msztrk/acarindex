import Link from 'next/link'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CatalogPdfLink({
  href,
  label,
  className,
}: {
  href: string
  label: string
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn('catalog-pdf-badge', className)}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden />
      PDF
    </Link>
  )
}
