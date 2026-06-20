import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

const SITEMAP_ARTICLES_PER_PAGE = 5000

async function getArticleSitemapPageCount(): Promise<number> {
  try {
    const sb = await createClient()
    const { count } = await sb
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
    if (!count) return 1
    return Math.max(1, Math.ceil(count / SITEMAP_ARTICLES_PER_PAGE))
  } catch {
    return 1
  }
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const isBeta = (process.env.NEXT_PUBLIC_SITE_URL ?? '').includes('beta')
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? canonicalBase

  if (isBeta) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  const pageCount = await getArticleSitemapPageCount()
  const articleSitemaps = Array.from({ length: pageCount }, (_, i) =>
    `${siteUrl}/sitemap-articles/${i + 1}.xml`,
  )

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/profile', '/profile/', '/api/', '/login', '/register'],
      },
    ],
    sitemap: [
      `${siteUrl}/sitemap.xml`,
      `${siteUrl}/sitemap-journals.xml`,
      ...articleSitemaps,
    ],
  }
}
