import type { Metadata } from 'next'
import { buildCanonicalUrl } from '@/lib/seo/url-contracts'
import { buildArticlePath, buildJournalCatalogPath, hasEnglishUrl } from '@/lib/i18n/slugs'
import { hreflangCode, type SiteLocale } from '@/lib/i18n/locale'

type ArticleHreflangRow = {
  id: number
  slug: string
  slugTr?: string | null
  slugEn?: string | null
  legacyJournalSlug: string
  legacyJournalSlugEn?: string | null
  titleEn?: string | null
}

type JournalHreflangRow = {
  id: number
  slug: string
  slugTr?: string | null
  slugEn?: string | null
}

export function buildArticleMetadataAlternates(
  base: string,
  row: ArticleHreflangRow,
  locale: SiteLocale,
): NonNullable<Metadata['alternates']> {
  const trPath = buildArticlePath(row, 'tr')
  const canonicalPath = buildArticlePath(row, locale)
  const languages: Record<string, string> = {
    tr: buildCanonicalUrl(base, trPath),
    'x-default': buildCanonicalUrl(base, trPath),
  }
  if (hasEnglishUrl(row)) {
    languages.en = buildCanonicalUrl(base, buildArticlePath(row, 'en'))
  }
  return {
    canonical: buildCanonicalUrl(base, canonicalPath),
    languages,
  }
}

export function buildJournalMetadataAlternates(
  base: string,
  row: JournalHreflangRow,
  locale: SiteLocale,
  subPath = '',
): NonNullable<Metadata['alternates']> {
  const trPath = `${buildJournalCatalogPath(row, 'tr')}${subPath}`
  const canonicalPath = `${buildJournalCatalogPath(row, locale)}${subPath}`
  const languages: Record<string, string> = {
    tr: buildCanonicalUrl(base, trPath),
    'x-default': buildCanonicalUrl(base, trPath),
  }
  if (row.slugEn) {
    languages.en = buildCanonicalUrl(base, `${buildJournalCatalogPath(row, 'en')}${subPath}`)
  }
  return {
    canonical: buildCanonicalUrl(base, canonicalPath),
    languages,
  }
}

export function sitemapHreflangLinks(
  base: string,
  trPath: string,
  enPath: string | null,
): string {
  const trUrl = buildCanonicalUrl(base, trPath)
  let out = `    <xhtml:link rel="alternate" hreflang="tr" href="${escapeXml(trUrl)}"/>\n`
  out += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(trUrl)}"/>\n`
  if (enPath) {
    const enUrl = buildCanonicalUrl(base, enPath)
    out += `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}"/>\n`
  }
  return out
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function pickLocalizedTitle(
  titleTr: string | null | undefined,
  titleEn: string | null | undefined,
  locale: SiteLocale,
): string {
  if (locale === 'en') return titleEn?.trim() || titleTr?.trim() || ''
  return titleTr?.trim() || titleEn?.trim() || ''
}

export { hreflangCode }
