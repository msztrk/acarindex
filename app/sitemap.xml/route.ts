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
import { countPublishedArticles } from '@/lib/data/articles'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const PAGE_SIZE = 5000

async function countEnglishArticles() {
  return prisma.article.count({ where: { status: 'published', slugEn: { not: null } } })
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const now = new Date().toISOString().slice(0, 10)

  const [total, enTotal] = await Promise.all([countPublishedArticles(), countEnglishArticles()])
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const enPageCount = enTotal > 0 ? Math.ceil(enTotal / PAGE_SIZE) : 0

  const sitemaps: string[] = []

  sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-static</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)

  sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-journals</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)

  for (let i = 1; i <= pageCount; i++) {
    sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-articles/${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)
  }

  if (enTotal > 0) {
    sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-journals-en</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)
    for (let i = 1; i <= enPageCount; i++) {
      sitemaps.push(`  <sitemap>
    <loc>${base}/sitemap-articles-en/${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)
    }
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
