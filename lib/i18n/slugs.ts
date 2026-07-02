import { urlYap } from '@/lib/urls/slug'
import type { SiteLocale } from '@/lib/i18n/locale'
import { localePathPrefix } from '@/lib/i18n/locale'

export interface LocalizedJournalSlugs {
  slugTr: string
  slugEn: string | null
}

export interface LocalizedArticleSlugs {
  slugTr: string
  slugEn: string | null
  legacyJournalSlugTr: string
  legacyJournalSlugEn: string | null
}

export function buildSlugFromTitle(
  title: string | null | undefined,
  fallbackId: number,
  prefix = 'item',
): string {
  const trimmed = title?.trim()
  if (trimmed) {
    const s = urlYap(trimmed)
    if (s) return s
  }
  return `${prefix}-${fallbackId}`
}

export function resolveJournalSlug(
  row: { slug: string; slugTr?: string | null; slugEn?: string | null; titleTr?: string | null; titleEn?: string | null; id: number },
  locale: SiteLocale,
): string {
  const slugTr = row.slugTr ?? row.slug
  if (locale === 'en') {
    return row.slugEn ?? slugTr
  }
  return slugTr
}

export function resolveArticleSlugs(
  row: {
    id: number
    slug: string
    slugTr?: string | null
    slugEn?: string | null
    legacyJournalSlug: string
    legacyJournalSlugEn?: string | null
    titleTr?: string | null
    titleEn?: string | null
  },
  locale: SiteLocale,
): { journalSlug: string; articleSlug: string } {
  const journalSlugTr = row.legacyJournalSlug
  const articleSlugTr = row.slugTr ?? row.slug
  if (locale === 'en') {
    return {
      journalSlug: row.legacyJournalSlugEn ?? journalSlugTr,
      articleSlug: row.slugEn ?? articleSlugTr,
    }
  }
  return { journalSlug: journalSlugTr, articleSlug: articleSlugTr }
}

export function buildArticlePath(
  row: Parameters<typeof resolveArticleSlugs>[0],
  locale: SiteLocale,
): string {
  const { journalSlug, articleSlug } = resolveArticleSlugs(row, locale)
  return `${localePathPrefix(locale)}/${journalSlug}/${articleSlug}-${row.id}`
}

export function buildJournalCatalogPath(
  row: { id: number; slug: string; slugTr?: string | null; slugEn?: string | null },
  locale: SiteLocale,
): string {
  const slug = resolveJournalSlug(row, locale)
  return `${localePathPrefix(locale)}/journals/${slug}-${row.id}`
}

export function hasEnglishUrl(row: {
  slugEn?: string | null
  legacyJournalSlugEn?: string | null
  titleEn?: string | null
}): boolean {
  return !!(row.slugEn && (row.legacyJournalSlugEn ?? true))
}
