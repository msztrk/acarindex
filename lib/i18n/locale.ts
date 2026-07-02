/**
 * Site locale — TR default (unprefixed URLs), EN under /en/
 */
export type SiteLocale = 'tr' | 'en'

export const DEFAULT_LOCALE: SiteLocale = 'tr'
export const LOCALE_HEADER = 'x-site-locale'

export function isSiteLocale(value: string | null | undefined): value is SiteLocale {
  return value === 'tr' || value === 'en'
}

/** URL path prefix for locale (TR = none). */
export function localePathPrefix(locale: SiteLocale): string {
  return locale === 'en' ? '/en' : ''
}

/** Strip /en prefix from pathname; returns locale + remainder path. */
export function parseLocaleFromPathname(pathname: string): {
  locale: SiteLocale
  pathnameWithoutLocale: string
} {
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname === '/en' ? '/' : pathname.slice(3) || '/'
    return { locale: 'en', pathnameWithoutLocale: rest }
  }
  return { locale: 'tr', pathnameWithoutLocale: pathname }
}

/** Add locale prefix to an internal path (must start with /). */
export function withLocalePath(path: string, locale: SiteLocale): string {
  if (locale === DEFAULT_LOCALE) return path
  if (path === '/') return '/en'
  return `/en${path}`
}

export function hreflangCode(locale: SiteLocale): string {
  return locale === 'en' ? 'en' : 'tr'
}
