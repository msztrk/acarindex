import type { MetadataRoute } from 'next'

export const revalidate = 3600

export default function robots(): MetadataRoute.Robots {
  const isBeta = (process.env.NEXT_PUBLIC_SITE_URL ?? '').includes('beta')
  const canonicalBase = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'

  if (isBeta) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/profile', '/profile/', '/api/', '/login', '/register'],
      },
    ],
    // Sitemap index tek URL — tüm alt sitemaplar buradan keşfedilir
    sitemap: [`${canonicalBase}/sitemap.xml`],
  }
}
