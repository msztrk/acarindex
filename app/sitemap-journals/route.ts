/**
 * GET /sitemap-journals.xml
 *
 * Tüm yayımlanan dergi URL'lerini içerir.
 * Dergi sayısı ~birkaç bin olduğu için tek dosyada tutulur.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

export async function GET() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const sb = await createClient()

  const { data } = await sb
    .from('journals')
    .select('id, slug, updated_at')
    .eq('status', 'published')
    .order('id', { ascending: true })

  const journals = (data ?? []) as { id: number; slug: string; updated_at: string }[]

  const urls = journals.map((j) => {
    const lastmod = j.updated_at ? j.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
    return `  <url>
    <loc>${base}/journals/${j.slug}-${j.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
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
