import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '@/lib/utils'

export const typography = {
  pageHeading: 'type-page-heading',
  pageTitle: 'type-page-title',
  sectionTitle: 'type-section-title',
  sectionDesc: 'type-section-desc',
  cardTitle: 'type-card-title',
  cardMeta: 'type-card-meta',
  metaLabel: 'type-section-label',
  metaValue: 'type-meta-value',
  listTitle: 'type-list-title',
  journalListTitle: 'type-journal-list-title',
} as const

type TypographyProps<T extends ElementType> = {
  as?: T
  className?: string
} & ComponentPropsWithoutRef<T>

function createTypographyComponent<T extends ElementType>(
  defaultTag: T,
  typeClass: string,
) {
  return function TypographyComponent({
    as,
    className,
    ...props
  }: TypographyProps<T>) {
    const Tag = (as ?? defaultTag) as ElementType
    return <Tag className={cn(typeClass, className)} {...props} />
  }
}

export const PageTitle = createTypographyComponent('h1', typography.pageHeading)
export const SectionTitle = createTypographyComponent('h2', typography.sectionTitle)
export const CardTitle = createTypographyComponent('h3', typography.cardTitle)
export const MetaLabel = createTypographyComponent('span', typography.metaLabel)
export const MetaValue = createTypographyComponent('span', typography.metaValue)
