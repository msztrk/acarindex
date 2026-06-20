import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

export const revalidate = 3600

const CANONICAL_HOST = 'www.acarindex.com'
const CANONICAL_BASE = 'https://www.acarindex.com'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers()
  const host = headerStore.get('host') ?? ''
  const isCanonical = host === CANONICAL_HOST

  if (!isCanonical) {
    // beta.acarindex.com, *.vercel.app, localhost → tümünü engelle
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
    sitemap: [`${CANONICAL_BASE}/sitemap.xml`],
  }
}
