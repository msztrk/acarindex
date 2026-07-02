import { buildArticlePath, buildJournalCatalogPath } from '@/lib/i18n/slugs'
import { buildCanonicalUrl } from '@/lib/seo/url-contracts'
import { sitemapHreflangLinks } from '@/lib/seo/hreflang'

export function articleSitemapUrlEntry(
  base: string,
  row: {
    id: number
    slug: string
    slug_tr?: string | null
    slug_en?: string | null
    legacy_journal_slug: string
    legacy_journal_slug_en?: string | null
    updated_at: string
  },
  locale: 'tr' | 'en',
): string {
  const articleRow = {
    id: row.id,
    slug: row.slug,
    slugTr: row.slug_tr,
    slugEn: row.slug_en,
    legacyJournalSlug: row.legacy_journal_slug,
    legacyJournalSlugEn: row.legacy_journal_slug_en,
  }
  const loc = buildCanonicalUrl(base, buildArticlePath(articleRow, locale))
  const lastmod = row.updated_at.slice(0, 10)
  const trPath = buildArticlePath(articleRow, 'tr')
  const enPath = row.slug_en ? buildArticlePath(articleRow, 'en') : null
  const hreflang =
    locale === 'tr' ? sitemapHreflangLinks(base, trPath, enPath) : sitemapHreflangLinks(base, trPath, enPath)

  return `  <url>
    <loc>${loc}</loc>
${hreflang}    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
}

export function journalSitemapUrlEntry(
  base: string,
  row: {
    id: number
    slug: string
    slug_tr?: string | null
    slug_en?: string | null
    updated_at: string
  },
  locale: 'tr' | 'en',
): string {
  const journalRow = { id: row.id, slug: row.slug, slugTr: row.slug_tr, slugEn: row.slug_en }
  const loc = buildCanonicalUrl(base, buildJournalCatalogPath(journalRow, locale))
  const lastmod = row.updated_at.slice(0, 10)
  const trPath = buildJournalCatalogPath(journalRow, 'tr')
  const enPath = row.slug_en ? buildJournalCatalogPath(journalRow, 'en') : null
  const hreflang = sitemapHreflangLinks(base, trPath, enPath)

  return `  <url>
    <loc>${loc}</loc>
${hreflang}    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
}

export function sitemapUrlsetOpen(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`
}

export function sitemapXmlResponse(body: string) {
  return new Response(`${sitemapUrlsetOpen()}\n${body}\n</urlset>`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
