import {
  hasEnglishArticleContent,
  type ArticleContentFields,
} from '@/lib/i18n/content-availability'
import { isEnglishDocumentLanguage } from '@/lib/i18n/language'
import { areComparableTextsEqual } from '@/lib/i18n/text-normalization'

export type EnglishContentQuality = 'valid' | 'possible_fallback' | 'missing'

export function sameNormalizedTitleTrEn(article: ArticleContentFields): boolean {
  return areComparableTextsEqual(article.titleTr, article.titleEn)
}

export function sameNormalizedAbstractTrEn(article: ArticleContentFields): boolean {
  return areComparableTextsEqual(article.abstractTr, article.abstractEn)
}

export function sameTitleAndAbstractTrEn(article: ArticleContentFields): boolean {
  return sameNormalizedTitleTrEn(article) && sameNormalizedAbstractTrEn(article)
}

/** Quality label — does not change has_en_content indexing by itself. */
export function assessEnglishArticleContentQuality(
  article: ArticleContentFields,
): EnglishContentQuality {
  if (!hasEnglishArticleContent(article)) return 'missing'

  const langIsEn = isEnglishDocumentLanguage(article.language, article.documentLanguage)
  if (sameTitleAndAbstractTrEn(article) && !langIsEn) {
    return 'possible_fallback'
  }

  return 'valid'
}

export function isPossibleEnglishFallback(article: ArticleContentFields): boolean {
  return assessEnglishArticleContentQuality(article) === 'possible_fallback'
}
