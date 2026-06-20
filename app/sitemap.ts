import type { MetadataRoute } from 'next'

/**
 * Sitemap Index
 *
 * /sitemap.xml         → bu dosya (statik sayfalar + dergi listesi)
 * /sitemap/articles/[page].xml  → sayfalanmış makale sitemapları
 *
 * Next.js generateSitemaps + sitemap() birden fazla sitemap üretir.
 * Her dosya max 50.000 URL veya 50MB olabilir (Google limiti).
 */

export const revalidate = 3600

const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/journals`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/istatistikler`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]
}
