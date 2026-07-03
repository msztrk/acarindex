import type { SiteLocale } from '@/lib/i18n/locale'
import { hasMeaningfulText } from '@/lib/i18n/text-normalization'

export function pickLocalizedAbstract(
  abstractTr: string | null | undefined,
  abstractEn: string | null | undefined,
  locale: SiteLocale,
): string | undefined {
  if (locale === 'en') {
    const en = abstractEn?.trim()
    if (en && en !== '-' && hasMeaningfulText(en)) return en
    return undefined
  }
  const tr = abstractTr?.trim()
  if (tr && tr !== '-') return tr
  const en = abstractEn?.trim()
  return en && en !== '-' ? en : undefined
}

/** Journal description is TR-only in DB — never expose as EN metadata. */
export function pickLocalizedJournalDescription(
  description: string | null | undefined,
  locale: SiteLocale,
): string | undefined {
  if (locale === 'en') return undefined
  const text = description?.trim()
  return text || undefined
}
