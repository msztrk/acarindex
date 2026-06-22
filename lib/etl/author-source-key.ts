/**
 * Deterministik yazar source_key üretimi (isim içermez).
 */

export function mysqlAuthorSourceKey(legacyAuthorId: number): string {
  return `mysql-author:${legacyAuthorId}`
}

export function articleAuthorSourceKey(articleId: number, authorPosition: number): string {
  return `article:${articleId}:position:${authorPosition}`
}

/** Eski formatları yeni standarda çevirir (backfill/migration). */
export function normalizeStoredSourceKey(key: string): string {
  const mysqlOld = /^mysql_yazarlar:(\d+)$/.exec(key)
  if (mysqlOld) return mysqlAuthorSourceKey(parseInt(mysqlOld[1], 10))

  const articleOld = /^article:(\d+):pos:(\d+)$/.exec(key)
  if (articleOld) return articleAuthorSourceKey(parseInt(articleOld[1], 10), parseInt(articleOld[2], 10))

  const legacyNeg = /^legacy_neg:(-?\d+)$/.exec(key)
  if (legacyNeg) return key // çözülmemiş — backfill script raporlar

  return key
}

export const SOURCE_KEY_MIGRATION_HINT =
  'authors.source_key kolonu bulunamadı. Önce migration 017 ve 018/019 uygulayın (supabase/migrations/).'
