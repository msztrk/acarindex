/**
 * GET /sitemap.xml
 *
 * Sitemap Index — tüm alt sitemaplara referans verir.
 *
 * Alt sitemaplar:
 *   /sitemap-static        → anasayfa, arama, hakkımızda vb. (sabit sayfalar)
 *   /sitemap-journals      → tüm dergiler
 *   /sitemap-articles/1    → makaleler sayfa 1  (5000 URL/sayfa)
 *   /sitemap-articles/2    → makaleler sayfa 2
 *   …
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

const PAGE_SIZE = 5000

export async function GET() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const now = new Date().toISOString().slice(0, 10)

  const sb = await createClient()

  // Toplam makale sayısına göre kaç sayfa sitemap lazım?
  const { count: articleCount } = await sb
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  const total = articleCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const sitemaps: string[] = []

  // Statik sayfalar
  sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-static</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)

  // Dergiler
  sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-journals</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)

  // Makaleler (sayfalanmış)
  for (let i = 1; i <= pageCount; i++) {
    sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-articles/${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
