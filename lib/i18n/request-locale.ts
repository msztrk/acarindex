import { headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  type SiteLocale,
  isSiteLocale,
  parseLocaleFromPathname,
} from '@/lib/i18n/locale'

const ORIGINAL_PATH_HEADER = 'x-original-pathname'

/** Read locale from proxy rewrite header (server components). */
export async function getRequestLocale(): Promise<SiteLocale> {
  const h = await headers()
  for (const key of [LOCALE_HEADER, `x-middleware-request-${LOCALE_HEADER}`]) {
    const raw = h.get(key)
    if (isSiteLocale(raw)) return raw
  }
  for (const key of [ORIGINAL_PATH_HEADER, `x-middleware-request-${ORIGINAL_PATH_HEADER}`]) {
    const original = h.get(key)
    if (original) return parseLocaleFromPathname(original).locale
  }
  return DEFAULT_LOCALE
}
