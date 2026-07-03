import type { SiteLocale } from '@/lib/i18n/locale'

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

export function hasMeaningfulText(
  value?: string | null,
  minLength = MIN_TITLE_LENGTH,
): boolean {
  if (!value) return false
  return value.trim().length >= minLength
}

export function isEnglishLanguage(lang?: string | null): boolean {
  if (!lang) return false
  const normalized = lang.trim().toLowerCase()
  return normalized === 'en' || normalized.startsWith('en-') || normalized.startsWith('en_')
}

export function resolveDocumentLanguage(article: ArticleContentFields): string | null {
  const lang = article.documentLanguage?.trim() || article.language?.trim()
  return lang || null
}

/** Gerçek İngilizce makale içeriği — indeksleme / hreflang / EN sitemap için. */
export function hasEnglishArticleContent(article: ArticleContentFields): boolean {
  if (!hasMeaningfulText(article.titleEn, MIN_TITLE_LENGTH)) return false
  const lang = resolveDocumentLanguage(article)
  return (
    hasMeaningfulText(article.abstractEn, MIN_ABSTRACT_LENGTH) || isEnglishLanguage(lang)
  )
}

export function hasTurkishArticleContent(article: ArticleContentFields): boolean {
  if (!hasMeaningfulText(article.titleTr, MIN_TITLE_LENGTH)) return false
  const lang = resolveDocumentLanguage(article)
  if (isEnglishLanguage(lang) && !hasMeaningfulText(article.abstractTr, MIN_ABSTRACT_LENGTH)) {
    return hasMeaningfulText(article.titleTr, MIN_TITLE_LENGTH)
  }
  return (
    hasMeaningfulText(article.abstractTr, MIN_ABSTRACT_LENGTH) ||
    (!isEnglishLanguage(lang) && hasMeaningfulText(article.titleTr, MIN_TITLE_LENGTH))
  )
}

/** Dergi EN sayfası — en az anlamlı İngilizce başlık gerekir. */
export function hasEnglishJournalContent(journal: JournalContentFields): boolean {
  return hasMeaningfulText(journal.titleEn, MIN_TITLE_LENGTH)
}

export function hasTurkishJournalContent(journal: JournalContentFields): boolean {
  return hasMeaningfulText(journal.titleTr, MIN_TITLE_LENGTH)
}

export function computeArticleHasEnContent(article: ArticleContentFields): boolean {
  return hasEnglishArticleContent(article)
}

export function computeJournalHasEnContent(journal: JournalContentFields): boolean {
  return hasEnglishJournalContent(journal)
}

export function getAvailableLocales(
  entity: ArticleContentFields | JournalContentFields,
  kind: 'article' | 'journal',
): SiteLocale[] {
  const locales: SiteLocale[] = []
  if (kind === 'article') {
    const row = entity as ArticleContentFields
    if (hasTurkishArticleContent(row) || hasMeaningfulText(row.titleTr) || hasMeaningfulText(row.titleEn)) {
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

/** EN URL üretilebilir mi (slug fallback dahil) — indekslenebilirlik için kullanılmaz. */
export function canBuildEnglishArticleUrl(row: {
  slugEn?: string | null
  slugTr?: string | null
  slug?: string
}): boolean {
  return !!(row.slugEn ?? row.slugTr ?? row.slug)
}
