/**
 * GET /sitemap-articles/{page}.xml
 *
 * Sayfalanmış makale sitemap'leri (TR + hreflang).
 */

import { NextRequest, NextResponse } from 'next/server'
import { listArticlesForSitemapPage } from '@/lib/data/articles'
import { articleSitemapUrlEntry, sitemapXmlResponse } from '@/lib/sitemap/xml'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const PAGE_SIZE = 5000

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page: rawPage } = await params
  const page = parseInt(rawPage.replace('.xml', ''), 10)

  if (isNaN(page) || page < 1) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const articles = await listArticlesForSitemapPage(page, PAGE_SIZE)

  if (articles.length === 0 && page > 1) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const urls = articles.map((a) => articleSitemapUrlEntry(base, a, 'tr'))
  return sitemapXmlResponse(urls.join('\n'))
}
