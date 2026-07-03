/**
 * GET /sitemap-journals-en
 * English journal URLs (/en/journals/...) — yalnızca gerçek EN içerik.
 */
import { listEnglishJournalsForSitemap } from '@/lib/data/journals'
import { journalSitemapUrlEntry, sitemapXmlResponse } from '@/lib/sitemap/xml'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const journals = await listEnglishJournalsForSitemap(100000)
  const urls = journals.map((j) => journalSitemapUrlEntry(base, j, 'en'))
  return sitemapXmlResponse(urls.join('\n'))
}
