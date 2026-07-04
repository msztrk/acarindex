import { headers, cookies } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  LOCALE_COOKIE,
  type SiteLocale,
  isSiteLocale,
  parseLocaleFromPathname,
} from '@/lib/i18n/locale'

const ORIGINAL_PATH_HEADER = 'x-original-pathname'
const PATHNAME_HEADER = 'x-pathname'

/** Read locale from proxy rewrite header (server components). */
export async function getRequestLocale(): Promise<SiteLocale> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (isSiteLocale(fromCookie)) return fromCookie

  const h = await headers()
  for (const key of [LOCALE_HEADER, `x-middleware-request-${LOCALE_HEADER}`]) {
    const raw = h.get(key)
    if (isSiteLocale(raw)) return raw
  }
  for (const headerName of [PATHNAME_HEADER, ORIGINAL_PATH_HEADER]) {
    for (const key of [headerName, `x-middleware-request-${headerName}`]) {
      const original = h.get(key)
      if (original) return parseLocaleFromPathname(original).locale
    }
  }
  return DEFAULT_LOCALE
}
