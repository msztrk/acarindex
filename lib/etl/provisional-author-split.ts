/**
 * Provisional author split planlama (migration 019 ile uyumlu).
 * Her article_id + author_position çifti ayrı provisional author alır.
 */

import { articleAuthorSourceKey } from './author-source-key'

export interface AuthorRelationSlot {
  articleId: number
  authorPosition: number
}

/** Split sonrası yeni kayıtlar için legacy_id (article_id×100 ve ×100000 ile çakışmaz). */
export function splitProvisionalLegacyId(articleId: number, authorPosition: number): number {
  const packed = articleId * 10_000_000 + authorPosition
  if (!Number.isSafeInteger(packed)) {
    throw new Error(`splitProvisionalLegacyId overflow: article=${articleId} pos=${authorPosition}`)
  }
  return -packed
}

export interface SplitRelationPlan {
  /** Mevcut author kaydı korunur (ilk ilişki). */
  keepOriginalAuthor: boolean
  articleId: number
  authorPosition: number
  sourceKey: string
  legacyId: number
}

/** Deterministik split planı: ilişkiler article_id, author_position sırasına göre. */
export function planProvisionalAuthorSplit(
  relations: AuthorRelationSlot[],
): SplitRelationPlan[] {
  const sorted = [...relations].sort((a, b) => {
    if (a.articleId !== b.articleId) return a.articleId - b.articleId
    return a.authorPosition - b.authorPosition
  })

  return sorted.map((rel, index) => ({
    keepOriginalAuthor: index === 0,
    articleId: rel.articleId,
    authorPosition: rel.authorPosition,
    sourceKey: articleAuthorSourceKey(rel.articleId, rel.authorPosition),
    legacyId: index === 0
      ? splitProvisionalLegacyId(rel.articleId, rel.authorPosition)
      : splitProvisionalLegacyId(rel.articleId, rel.authorPosition),
  }))
}

/** Provisional author belirsiz mi (018/019 eşiği). */
export function isAmbiguousProvisionalRelationSet(relations: AuthorRelationSlot[]): boolean {
  if (relations.length <= 1) return false
  const articles = new Set(relations.map((r) => r.articleId))
  const positions = new Set(relations.map((r) => r.authorPosition))
  return articles.size > 1 || positions.size > 1
}

/** 100+ pozisyon aynı makalede — source key çakışması oluşturmaz. */
export function articleAuthorSourceKeysForPositions(
  articleId: number,
  positions: number[],
): string[] {
  return positions.map((p) => articleAuthorSourceKey(articleId, p))
}
