/**
 * GET /sitemap-articles/{page}.xml
 *
 * Sayfalanmış makale sitemap'leri.
 * Her sayfa 5000 URL içerir (Google 50.000'e kadar destekler; küçük tutmak crawl'ı hızlandırır).
 *
 * Örnek: /sitemap-articles/1.xml, /sitemap-articles/2.xml …
 *
 * Sitemap index (robots.txt veya /sitemap.xml sitemapIndex'inden referans verilmeli).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const sb = await createClient()

  const offset = (page - 1) * PAGE_SIZE

  const { data } = await sb
    .from('articles')
    .select('id, slug, legacy_journal_slug, updated_at')
    .eq('status', 'published')
    .order('id', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)

  const articles = (data ?? []) as {
    id: number
    slug: string
    legacy_journal_slug: string
    updated_at: string
  }[]

  if (articles.length === 0 && page > 1) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const urls = articles.map((a) => {
    const loc = `${base}/${a.legacy_journal_slug}/${a.slug}-${a.id}`
    const lastmod = a.updated_at ? a.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
