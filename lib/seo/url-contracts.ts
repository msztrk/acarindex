/**
 * SEO ve URL sözleşmesi — saf fonksiyonlar (gerçek kayıt sayısı gerektirmez).
 */
import { SITEMAP_ARTICLES_PAGE_SIZE } from '@/lib/data/constants'

export function buildCanonicalUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export function buildSearchPaginationCanonical(
  base: string,
  query: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.type && query.type !== 'article') params.set('type', query.type)
  if (query.area && query.area !== 'all') params.set('area', query.area)
  if (query.language) params.set('language', query.language)
  if (query.year_from) params.set('year_from', query.year_from)
  if (query.year_to) params.set('year_to', query.year_to)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${base}/search?${qs}` : `${base}/search`
}

export function estimateSitemapArticlePageCount(
  totalArticles: number,
  pageSize = SITEMAP_ARTICLES_PAGE_SIZE,
): number {
  if (totalArticles <= 0) return 1
  return Math.ceil(totalArticles / pageSize)
}

/** Arama ve PDF viewer sayfaları noindex */
export const NOINDEX_PUBLIC_ROUTES = ['/search', '/pdfs'] as const

export function pathShouldNoindex(pathname: string): boolean {
  if (pathname === '/search' || pathname.startsWith('/search?')) return true
  if (pathname.startsWith('/pdfs/')) return true
  if (pathname === '/login' || pathname === '/register' || pathname === '/profile') return true
  return false
}

/** PDF URL politikası: viewer noindex; proxy ve legacy tam URL HTTPS */
export function pdfUrlPolicy() {
  return {
    viewerPathPattern: '/pdfs/{articleId}',
    viewerRobots: 'noindex, nofollow',
    proxyPathPattern: '/api/pdf-proxy/{articleId}',
    legacyRequiresHttps: true,
    missingSentinel: 'pdf-bulunamadi',
  }
}
