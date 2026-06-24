/**
 * Makale slug çakışma politikası — legacy_id korunur; silme/birleştirme yok.
 *
 * URL: /{legacyJournalSlug}/{slug}-{articleId}
 * Çakışma: slug-{legacyId} son eki; gerekirse url_aliases 301.
 */

export function buildArticleCanonicalPath(
  legacyJournalSlug: string,
  slug: string,
  articleId: number,
): string {
  return `/${legacyJournalSlug}/${slug}-${articleId}`
}

export function slugWithLegacyIdSuffix(baseSlug: string, legacyId: number): string {
  return `${baseSlug}-${legacyId}`
}

export interface ResolveArticleSlugInput {
  baseSlug: string
  legacyId: number
  legacyJournalSlug: string
  existingSlug: string | null | undefined
  /** Aynı slug değerini kullanan başka makale (varsa en düşük id öncelikli) */
  conflictingArticleLegacyId: number | null
}

export interface ArticleUrlAliasPlan {
  legacyPath: string
  canonicalPath: string
  entityType: 'article'
  entityId: number
  httpStatus: number
}

export interface ResolveArticleSlugResult {
  slug: string
  urlAlias: ArticleUrlAliasPlan | null
}

/**
 * Deterministik slug seçimi. İkinci ETL çalışması aynı slug'ı üretir.
 */
export function resolveArticleSlug(input: ResolveArticleSlugInput): ResolveArticleSlugResult {
  const { baseSlug, legacyId, legacyJournalSlug, existingSlug, conflictingArticleLegacyId } =
    input
  const suffixed = slugWithLegacyIdSuffix(baseSlug, legacyId)
  const articleId = legacyId

  // Zaten suffix ile kayıtlı — idempotent
  if (existingSlug === suffixed) {
    return { slug: suffixed, urlAlias: null }
  }

  const isOwner =
    conflictingArticleLegacyId == null || legacyId < conflictingArticleLegacyId

  if (isOwner) {
    if (existingSlug === baseSlug || !existingSlug) {
      return { slug: baseSlug, urlAlias: null }
    }
    // Özel slug — dokunma
    return { slug: existingSlug, urlAlias: null }
  }

  // Çakışan makale daha düşük legacy id — suffix zorunlu
  const slug = suffixed
  let urlAlias: ArticleUrlAliasPlan | null = null

  if (existingSlug === baseSlug) {
    const legacyPath = buildArticleCanonicalPath(legacyJournalSlug, baseSlug, articleId)
    const canonicalPath = buildArticleCanonicalPath(legacyJournalSlug, slug, articleId)
    if (legacyPath !== canonicalPath) {
      urlAlias = {
        legacyPath,
        canonicalPath,
        entityType: 'article',
        entityId: articleId,
        httpStatus: 301,
      }
    }
  }

  return { slug, urlAlias }
}

/** Alias döngüsü: canonical hedef başka bir legacy alias olmamalı */
export function isAliasCycle(
  legacyPath: string,
  canonicalPath: string,
  existingAliases: Map<string, string>,
): boolean {
  if (legacyPath === canonicalPath) return true
  let cursor: string | undefined = canonicalPath
  const seen = new Set<string>()
  while (cursor) {
    if (cursor === legacyPath) return true
    if (seen.has(cursor)) return true
    seen.add(cursor)
    cursor = existingAliases.get(cursor)
  }
  return false
}
