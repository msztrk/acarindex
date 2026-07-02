import { headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  type SiteLocale,
  isSiteLocale,
} from '@/lib/i18n/locale'

/** Read locale from proxy rewrite header (server components). */
export async function getRequestLocale(): Promise<SiteLocale> {
  const h = await headers()
  const raw = h.get(LOCALE_HEADER)
  return isSiteLocale(raw) ? raw : DEFAULT_LOCALE
}
