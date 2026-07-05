import type { SiteLocale } from '@/lib/i18n/locale'
import { hasMeaningfulText } from '@/lib/i18n/text-normalization'
import { pickLocalizedTitle } from '@/lib/seo/hreflang'

function normalizeAbstract(value: string | null | undefined): string | null {
  const text = value?.trim()
  if (!text || text === '-') return null
  return text
}

export type ArticleAbstractSection = {
  heading: string
  text: string
}

export function buildArticleAbstractSections(
  abstractTr: string | null | undefined,
  abstractEn: string | null | undefined,
  locale: SiteLocale,
): ArticleAbstractSection[] {
  const tr = normalizeAbstract(abstractTr)
  const en = normalizeAbstract(abstractEn)

  if (locale === 'en') {
    const sections: ArticleAbstractSection[] = []
    if (en) sections.push({ heading: 'Abstract', text: en })
    if (tr && tr !== en) sections.push({ heading: 'Özet', text: tr })
    return sections
  }

  const sections: ArticleAbstractSection[] = []
  if (tr) sections.push({ heading: 'Özet', text: tr })
  if (en && en !== tr) sections.push({ heading: 'Abstract', text: en })
  return sections
}

export function pickAlternateTitle(
  titleTr: string | null | undefined,
  titleEn: string | null | undefined,
  locale: SiteLocale,
  primaryTitle: string,
): string | null {
  const otherRaw = locale === 'en' ? titleTr?.trim() : titleEn?.trim()
  if (!otherRaw || otherRaw === '-' || otherRaw === primaryTitle) return null
  return otherRaw
}

export function pickLocalizedArticleDisplayTitle(
  titleTr: string | null | undefined,
  titleEn: string | null | undefined,
  locale: SiteLocale,
): string {
  return pickLocalizedTitle(titleTr, titleEn, locale) || (locale === 'en' ? 'Untitled' : 'Başlıksız')
}

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
