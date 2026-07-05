import type { SiteLocale } from '@/lib/i18n/locale'
import {
  computeArticleHasEnglishContent,
  computeJournalHasEnglishContent,
  hasEnglishJournalContent,
  hasMeaningfulText,
  hasTurkishJournalContent,
  type ArticleContentFields,
  type JournalContentFields,
} from '@/lib/i18n/content-availability'

export type ArticleEnRouteFields = ArticleContentFields & {
  has_en_content?: boolean | null
}

export type JournalEnRouteFields = JournalContentFields & {
  has_en_content?: boolean | null
}

export function articleHasEnIndexAccess(article: ArticleEnRouteFields): boolean {
  if (article.has_en_content != null) return article.has_en_content
  return computeArticleHasEnglishContent(article)
}

export function journalHasEnIndexAccess(journal: JournalEnRouteFields): boolean {
  if (journal.has_en_content != null) return journal.has_en_content
  return computeJournalHasEnglishContent(journal)
}

/** EN locale UI for published journal catalog (localized fields + TR fallbacks). */
export function journalAllowsEnglishLocale(journal: JournalEnRouteFields): boolean {
  if (journal.has_en_content === true) return true
  if (hasEnglishJournalContent(journal)) return true
  return hasTurkishJournalContent(journal) || hasMeaningfulText(journal.titleTr)
}

export function shouldRedirectEnArticleToTr(
  locale: SiteLocale,
  article: ArticleEnRouteFields,
): boolean {
  return locale === 'en' && !articleHasEnIndexAccess(article)
}

export function shouldRedirectEnJournalToTr(
  locale: SiteLocale,
  journal: JournalEnRouteFields,
): boolean {
  return locale === 'en' && !journalAllowsEnglishLocale(journal)
}
