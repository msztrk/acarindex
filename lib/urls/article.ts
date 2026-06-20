/**
 * Makale URL yardımcıları
 *
 * Canonical format (legacy = kalıcı):
 *   /{journalSlug}/{articleSlug}-{articleId}
 *
 * Örnek:
 *   /turkish-studies-social-sciences/milli-mucadele-809939
 */

import { urlYap } from './slug'

export interface ArticleUrlParts {
  journalSlug: string
  articleSlug: string
  articleId: number
}

/**
 * Veritabanı satırından canonical URL üretir.
 */
export function buildArticleUrl(
  legacyJournalSlug: string,
  titleTr: string,
  articleId: number,
): string {
  const articleSlug = urlYap(titleTr)
  return `/${legacyJournalSlug}/${articleSlug}-${articleId}`
}

/**
 * URL path segmentini parse eder.
 *
 * Input:  { journalSlug: 'turkish-studies', articleSlugAndId: 'makale-adi-809939' }
 * Output: { journalSlug, articleSlug, articleId } | null
 *
 * Son segment "-{numericId}" formatında olmalı.
 */
export function parseArticlePath(
  journalSlug: string,
  articleSlugAndId: string,
): ArticleUrlParts | null {
  const match = articleSlugAndId.match(/^(.+)-(\d+)$/)
  if (!match) return null

  const articleSlug = match[1]
  const articleId = parseInt(match[2], 10)

  if (!articleSlug || isNaN(articleId) || articleId <= 0) return null

  return { journalSlug, articleSlug, articleId }
}

/**
 * Makale ID'sini URL'den doğrudan çıkarır (slug kontrolü yapmadan).
 * 404 fallback için kullanılır.
 */
export function extractArticleId(articleSlugAndId: string): number | null {
  const match = articleSlugAndId.match(/-(\d+)$/)
  if (!match) return null
  const id = parseInt(match[1], 10)
  return isNaN(id) || id <= 0 ? null : id
}
