/**
 * GET /sitemap-journals.xml
 *
 * Tüm yayımlanan dergi URL'lerini içerir (TR + hreflang).
 */

import { listJournalsForSitemap } from '@/lib/data/journals'
import { journalSitemapUrlEntry, sitemapXmlResponse } from '@/lib/sitemap/xml'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const journals = await listJournalsForSitemap(100000)
  const urls = journals.map((j) => journalSitemapUrlEntry(base, j, 'tr'))
  return sitemapXmlResponse(urls.join('\n'))
}
