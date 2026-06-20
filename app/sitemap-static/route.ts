/**
 * GET /sitemap-static
 * Sabit sayfalar sitemap'i
 */

import { NextResponse } from 'next/server'

export const revalidate = 86400

export async function GET() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const now = new Date().toISOString().slice(0, 10)

  const pages = [
    { path: '/',              changefreq: 'daily',   priority: '1.0' },
    { path: '/journals',      changefreq: 'weekly',  priority: '0.9' },
    { path: '/search',        changefreq: 'weekly',  priority: '0.8' },
    { path: '/istatistikler', changefreq: 'daily',   priority: '0.7' },
    { path: '/about',         changefreq: 'monthly', priority: '0.5' },
    { path: '/contact',       changefreq: 'monthly', priority: '0.4' },
    { path: '/applications',  changefreq: 'monthly', priority: '0.4' },
    { path: '/kurumsal',      changefreq: 'monthly', priority: '0.4' },
  ]

  const urls = pages.map(p => `  <url>
    <loc>${base}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
