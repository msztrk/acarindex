import type { SiteLocale } from '@/lib/i18n/locale'
import {
  isEnglishDocumentLanguage,
  isEnglishLanguage,
  isTurkishLanguage,
} from '@/lib/i18n/language'
import { hasMeaningfulText } from '@/lib/i18n/text-normalization'

export { hasMeaningfulText } from '@/lib/i18n/text-normalization'
export { isEnglishLanguage, isTurkishLanguage } from '@/lib/i18n/language'

export const MIN_TITLE_LENGTH = 10
export const MIN_ABSTRACT_LENGTH = 20

export type ArticleContentFields = {
  titleTr?: string | null
  titleEn?: string | null
  abstractTr?: string | null
  abstractEn?: string | null
  language?: string | null
  documentLanguage?: string | null
}

export type JournalContentFields = {
  titleTr?: string | null
  titleEn?: string | null
  description?: string | null
  about?: string | null
  aimAndScope?: string | null
}

export function resolveDocumentLanguage(article: ArticleContentFields): string | null {
  const lang = article.documentLanguage?.trim() || article.language?.trim()
  return lang || null
}

/** Gerçek İngilizce makale içeriği — indeksleme / hreflang / EN sitemap için. */
export function hasEnglishArticleContent(article: ArticleContentFields): boolean {
  if (!hasMeaningfulText(article.titleEn, MIN_TITLE_LENGTH)) return false
  return (
    hasMeaningfulText(article.abstractEn, MIN_ABSTRACT_LENGTH) ||
    isEnglishDocumentLanguage(article.language, article.documentLanguage)
  )
}

export function hasTurkishArticleContent(article: ArticleContentFields): boolean {
  if (!hasMeaningfulText(article.titleTr, MIN_TITLE_LENGTH)) return false
  const lang = resolveDocumentLanguage(article)
  if (
    isEnglishLanguage(lang) &&
    !hasMeaningfulText(article.abstractTr, MIN_ABSTRACT_LENGTH)
  ) {
    return hasMeaningfulText(article.titleTr, MIN_TITLE_LENGTH)
  }
  return (
    hasMeaningfulText(article.abstractTr, MIN_ABSTRACT_LENGTH) ||
    (isTurkishLanguage(lang) && hasMeaningfulText(article.titleTr, MIN_TITLE_LENGTH))
  )
}

/** Dergi EN sayfası — anlamlı İngilizce başlık gerekir. */
export function hasEnglishJournalContent(journal: JournalContentFields): boolean {
  return hasMeaningfulText(journal.titleEn, MIN_TITLE_LENGTH)
}

export function hasTurkishJournalContent(journal: JournalContentFields): boolean {
  return hasMeaningfulText(journal.titleTr, MIN_TITLE_LENGTH)
}

/** Single source of truth for DB has_en_content (articles). */
export function computeArticleHasEnglishContent(article: ArticleContentFields): boolean {
  return hasEnglishArticleContent(article)
}

/** @deprecated Use computeArticleHasEnglishContent */
export const computeArticleHasEnContent = computeArticleHasEnglishContent

/** Single source of truth for DB has_en_content (journals). */
export function computeJournalHasEnglishContent(journal: JournalContentFields): boolean {
  return hasEnglishJournalContent(journal)
}

/** @deprecated Use computeJournalHasEnglishContent */
export const computeJournalHasEnContent = computeJournalHasEnglishContent

export function getAvailableLocales(
  entity: ArticleContentFields | JournalContentFields,
  kind: 'article' | 'journal',
): SiteLocale[] {
  const locales: SiteLocale[] = []
  if (kind === 'article') {
    const row = entity as ArticleContentFields
    if (
      hasTurkishArticleContent(row) ||
      hasMeaningfulText(row.titleTr) ||
      hasMeaningfulText(row.titleEn)
    ) {
      locales.push('tr')
    }
    if (hasEnglishArticleContent(row)) locales.push('en')
    return locales.length > 0 ? locales : ['tr']
  }
  const row = entity as JournalContentFields
  if (hasTurkishJournalContent(row) || hasMeaningfulText(row.titleTr)) locales.push('tr')
  if (hasEnglishJournalContent(row)) locales.push('en')
  return locales.length > 0 ? locales : ['tr']
}

/** EN URL üretilebilir mi (slug fallback) — indekslenebilirlik için kullanılmaz. */
export function canBuildEnglishArticleUrl(row: {
  slugEn?: string | null
  slugTr?: string | null
  slug?: string
}): boolean {
  return !!(row.slugEn ?? row.slugTr ?? row.slug)
}
