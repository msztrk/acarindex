/**
 * Legacy PHP üyelik URL'leri → Next.js auth/hesap rotaları.
 * proxy.ts ve profil catch-all sayfalarında kullanılır.
 */

/** url_aliases lookup'ından muaf tutulacak uygulama path prefix'leri */
export const APP_ROUTE_PREFIXES = [
  '/hesabim',
  '/login',
  '/register',
  '/profile',
  '/admin',
  '/api',
  '/auth',
  '/search',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const

/** Makale catch-all rotasının yorumlamaması gereken ilk segmentler */
export const RESERVED_JOURNAL_SLUGS = new Set([
  'hesabim',
  'profil',
  'login',
  'register',
  'profile',
  'admin',
  'search',
  'journals',
  'authors',
  'pdfs',
  'auth',
  'api',
  'giris',
  'kayit',
  'nreg',
])

const EXACT_LEGACY_REDIRECTS: Record<string, string> = {
  '/giris': '/login',
  '/kayit': '/register',
  '/nreg': '/register',
  '/profil': '/hesabim',
}

/** /profil/{islem} → yeni hesap paneli */
const PROFIL_SUBPATH_REDIRECTS: Record<string, string> = {
  ayarlar: '/hesabim',
  favoriler: '/hesabim/kaydedilen',
  dashboard: '/hesabim',
  accsess: '/hesabim/security',
}

export function isAppReservedPath(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function resolveLegacyAuthRedirect(pathname: string): string | null {
  const exact = EXACT_LEGACY_REDIRECTS[pathname]
  if (exact) return exact

  const profilMatch = pathname.match(/^\/profil(?:\/([^/]+))?\/?$/)
  if (!profilMatch) return null

  const sub = profilMatch[1]
  if (!sub) return '/hesabim'

  return PROFIL_SUBPATH_REDIRECTS[sub] ?? '/hesabim'
}

/** [journalSlug] makale rotasında ayrılmış segment → hesap/auth sayfasına yönlendir */
export function resolveReservedJournalSlugRedirect(journalSlug: string): string | null {
  switch (journalSlug) {
    case 'hesabim':
    case 'profil':
      return '/hesabim'
    case 'login':
    case 'giris':
      return '/login'
    case 'register':
    case 'kayit':
    case 'nreg':
      return '/register'
    case 'profile':
      return '/profile'
    default:
      return RESERVED_JOURNAL_SLUGS.has(journalSlug) ? '/' : null
  }
}
