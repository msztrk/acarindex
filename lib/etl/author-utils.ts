/**
 * Yazar ETL: ayrıştırma, güvenli normalizasyon ve kimlik yardımcıları.
 * Otomatik kişi birleştirme veya isim benzerliği eşleştirmesi yapılmaz.
 */

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

const UNICODE_LETTER = /\p{L}/u
const UNICODE_LETTER_MARK = /[\p{L}\p{M}]/u

/** Ham metindeki HTML entity'leri temizler (gösterim adı için). */
export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&([a-zA-Z]+);/g, (_, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? `&${name};`)
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = parseInt(code, 10)
      return Number.isFinite(n) ? String.fromCharCode(n) : `&#${code};`
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const n = parseInt(hex, 16)
      return Number.isFinite(n) ? String.fromCharCode(n) : `&#x${hex};`
    })
}

/** Kenar noktalama/boşluk temizliği (Unicode harfler korunur). */
export function trimAuthorEdges(name: string): string {
  return name
    .replace(/^[^\p{L}\p{M}]+/u, '')
    .replace(/[^\p{L}\p{M}]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Gösterim adı: trim, boşluk birleştirme, kenar noktalama; transliterasyon yok. */
export function normalizeAuthorDisplayName(name: string): string {
  return trimAuthorEdges(decodeHtmlEntities(name))
}

/** Eşleştirme/karşılaştırma anahtarı (kalıcı depolama için değil). */
export function normalizeAuthorMatchKey(name: string): string {
  return normalizeAuthorDisplayName(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Yalnızca noktalama veya sayı — atlanır. */
export function isOnlyPunctuationOrDigits(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return !UNICODE_LETTER.test(trimmed)
}

/**
 * Kimlik için yetersiz: tek harf + noktalama (ör. "B.") veya toplam <2 harf.
 * "A. Yılmaz" yeterli; "B." yetersiz.
 */
export function isInsufficientIdentity(display: string): boolean {
  const letters = display.match(/\p{L}/gu) ?? []
  if (letters.length >= 2) return false
  if (letters.length === 0) return true
  // Tek harf
  return display.replace(/[^\p{L}]/gu, '').length < 2
}

/**
 * Virgülle ayrılmış parçalarda "Soyad, Ad" veya "Abel, Jr. ALVAREZ" birleştirme.
 * Tahmine dayalı ad-soyad ters çevirme yapılmaz.
 */
export function mergeInvertedNameCommaParts(parts: string[]): string[] {
  const result: string[] = []
  let i = 0
  while (i < parts.length) {
    const curr = parts[i].trim()
    const next = parts[i + 1]?.trim()
    if (
      next &&
      curr.length >= 2 &&
      !curr.includes(' ') &&
      next.includes(' ') &&
      UNICODE_LETTER.test(curr) &&
      !/^\p{L}\.?$/u.test(curr)
    ) {
      result.push(`${curr}, ${next}`)
      i += 2
    } else if (curr.length >= 1) {
      result.push(curr)
      i += 1
    } else {
      i += 1
    }
  }
  return result
}

function splitCommaSegment(segment: string): string[] {
  const rawParts = segment.split(',').map((s) => s.trim()).filter(Boolean)
  return mergeInvertedNameCommaParts(rawParts)
}

export type AuthorParseRejectReason = 'only_punctuation' | 'insufficient_identity'

export interface ParsedAuthorToken {
  display: string
  rejected?: AuthorParseRejectReason
}

/** Ham segmentleri ayrıştırır; reddedilen tokenler ayrı raporlanır. */
export function parseAuthorTokens(raw: string | null | undefined): ParsedAuthorToken[] {
  if (!raw) return []
  const cleaned = decodeHtmlEntities(raw).trim()
  if (!cleaned) return []

  const segments = cleaned.split(';').flatMap((seg) => splitCommaSegment(seg))
  const seen = new Set<string>()
  const out: ParsedAuthorToken[] = []

  for (const seg of segments) {
    const display = normalizeAuthorDisplayName(seg)
    if (!display) continue
    if (isOnlyPunctuationOrDigits(display)) {
      out.push({ display, rejected: 'only_punctuation' })
      continue
    }
    if (isInsufficientIdentity(display)) {
      out.push({ display, rejected: 'insufficient_identity' })
      continue
    }
    const key = normalizeAuthorMatchKey(display)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ display })
  }
  return out
}

/**
 * Yazar listesini ayrıştırır. Önce noktalı virgül, sonra virgül (Soyad, Ad birleştirme ile).
 */
export function parseAuthorList(raw: string | null | undefined): string[] {
  return parseAuthorTokens(raw)
    .filter((t) => !t.rejected)
    .map((t) => t.display)
}

/** mysql yazarlar.id için güvenilir kaynak kimliği. */
export function yazarlarLegacyId(yazarlarId: number): number {
  return yazarlarId
}

// source_key üretimi: lib/etl/author-source-key.ts

/**
 * Kaynak yazar ID yoksa makale+pozisyon bazlı provisional legacy_id.
 * bigint kolonunda güvenli; max makale ID ~1M × 100 + pos < 2^31.
 */
export function provisionalLegacyId(articleId: number, position: number): number {
  const packed = articleId * 100 + position
  if (packed > 2_147_483_647) {
    throw new Error(`provisionalLegacyId overflow: article=${articleId} pos=${position}`)
  }
  return -packed
}

export function evaluateProvisionalLegacyIdBounds(maxArticleId: number, maxPosition: number): {
  packed: number
  fitsInt32: boolean
  fitsBigint: boolean
} {
  const packed = maxArticleId * 100 + maxPosition
  return {
    packed,
    fitsInt32: packed <= 2_147_483_647,
    fitsBigint: packed <= Number.MAX_SAFE_INTEGER,
  }
}

export function isProvisionalLegacyId(legacyId: number): boolean {
  return legacyId < 0
}

export interface YazarlarRegistry {
  resolve(displayName: string): { yazarlarId: number } | { ambiguous: true } | null
}

export function buildYazarlarRegistry(
  rows: Array<{ id: number; yazar: string }>,
): YazarlarRegistry {
  const byKey = new Map<string, number[]>()
  for (const row of rows) {
    const key = normalizeAuthorMatchKey(row.yazar)
    if (!key) continue
    const list = byKey.get(key) ?? []
    if (!list.includes(row.id)) list.push(row.id)
    byKey.set(key, list)
  }

  return {
    resolve(displayName: string) {
      const key = normalizeAuthorMatchKey(displayName)
      const ids = byKey.get(key)
      if (!ids || ids.length === 0) return null
      if (ids.length > 1) return { ambiguous: true }
      return { yazarlarId: ids[0] }
    },
  }
}

export type CommaAuthorClass =
  | 'multi_author'
  | 'inverted_name'
  | 'mixed_format'
  | 'bad_data'
  | 'undecided'

export interface CommaSampleClassification {
  articleId: number
  raw: string
  classification: CommaAuthorClass
  parsedCount: number
  note?: string
}

/** Virgüllü yazar metnini örneklem sınıflandırması. */
export function classifyCommaAuthorSample(
  articleId: number,
  raw: string,
): CommaSampleClassification {
  const trimmed = raw.trim()
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  const parsed = parseAuthorList(trimmed)
  const merged = mergeInvertedNameCommaParts(parts)

  if (parts.length === 1) {
    return { articleId, raw: trimmed.slice(0, 120), classification: 'undecided', parsedCount: parsed.length }
  }

  if (merged.length === 1 && parts.length === 2) {
    return { articleId, raw: trimmed.slice(0, 120), classification: 'inverted_name', parsedCount: parsed.length }
  }

  if (parsed.length >= 2 && merged.length === parsed.length) {
    return { articleId, raw: trimmed.slice(0, 120), classification: 'multi_author', parsedCount: parsed.length }
  }

  if (parsed.length === 0) {
    return { articleId, raw: trimmed.slice(0, 120), classification: 'bad_data', parsedCount: 0 }
  }

  if (merged.length !== parsed.length) {
    return {
      articleId,
      raw: trimmed.slice(0, 120),
      classification: 'mixed_format',
      parsedCount: parsed.length,
      note: `parts=${parts.length} merged=${merged.length}`,
    }
  }

  return { articleId, raw: trimmed.slice(0, 120), classification: 'undecided', parsedCount: parsed.length }
}

export function summarizeCommaClassifications(samples: CommaSampleClassification[]): Record<CommaAuthorClass, number> {
  const counts: Record<CommaAuthorClass, number> = {
    multi_author: 0,
    inverted_name: 0,
    mixed_format: 0,
    bad_data: 0,
    undecided: 0,
  }
  for (const s of samples) counts[s.classification]++
  return counts
}

export interface ProvisionalFragmentationProfile {
  provisionalProfileCount: number
  normalizeNamesWithMultipleProfiles: number
  topFragmentedNames: Array<{ normalized: string; profileCount: number; sampleDisplay: string }>
  singleArticleProvisionalPct: number
  yazarlarMatchFailures: {
    noRegistryMatch: number
    ambiguous: number
    matched: number
  }
}

export interface ArticleAuthorRow {
  id: number
  authors_raw: string | null
  status?: string | null
}

/** Provisional parçalanma profili (otomatik merge yapmaz). */
export function profileProvisionalFragmentation(
  articles: ArticleAuthorRow[],
  registry: YazarlarRegistry,
): ProvisionalFragmentationProfile {
  const normToArticleIds = new Map<string, Set<number>>()
  const normToDisplay = new Map<string, string>()
  let matched = 0
  let ambiguous = 0
  let noMatch = 0
  let provisionalRows = 0

  for (const art of articles) {
    const parsed = parseAuthorList(art.authors_raw)
    for (const display of parsed) {
      const resolved = registry.resolve(display)
      if (resolved && 'yazarlarId' in resolved) {
        matched++
        continue
      }
      if (resolved && 'ambiguous' in resolved) ambiguous++
      else noMatch++
      provisionalRows++
      const nk = normalizeAuthorMatchKey(display)
      const set = normToArticleIds.get(nk) ?? new Set()
      set.add(art.id)
      normToArticleIds.set(nk, set)
      if (!normToDisplay.has(nk)) normToDisplay.set(nk, display)
    }
  }

  const fragmented = [...normToArticleIds.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([nk, ids]) => ({
      normalized: nk,
      profileCount: ids.size,
      sampleDisplay: normToDisplay.get(nk) ?? nk,
    }))
    .sort((a, b) => b.profileCount - a.profileCount)

  const singleArticlePct =
    normToArticleIds.size === 0
      ? 0
      : (Array.from(normToArticleIds.values()).filter((s) => s.size === 1).length / normToArticleIds.size) * 100

  return {
    provisionalProfileCount: provisionalRows,
    normalizeNamesWithMultipleProfiles: fragmented.length,
    topFragmentedNames: fragmented.slice(0, 50),
    singleArticleProvisionalPct: singleArticlePct,
    yazarlarMatchFailures: { noRegistryMatch: noMatch, ambiguous, matched },
  }
}

export interface AuthorProfileStats {
  totalArticles: number
  withAuthors: number
  emptyAuthors: number
  parsedAuthorTokens: number
  uniqueRawNames: number
  uniqueNormalizedNames: number
  sameNormalizedDifferentRaw: number
  maxAuthorsPerArticle: number
  singleAuthorArticles: number
  multiAuthorArticles: number
  unparseableSamples: string[]
  insufficientIdentitySamples: string[]
  delimiterCounts: { comma: number; semicolon: number; andWord: number; veWord: number }
  normalizedCollisionSamples: Array<{ normalized: string; rawVariants: string[] }>
}

export function profileAuthorSource(articles: ArticleAuthorRow[]): AuthorProfileStats {
  const rawSet = new Set<string>()
  const normToRaw = new Map<string, Set<string>>()
  let withAuthors = 0
  let emptyAuthors = 0
  let parsedTokens = 0
  let maxAuthors = 0
  let single = 0
  let multi = 0
  const unparseable: string[] = []
  const insufficient: string[] = []
  const delim = { comma: 0, semicolon: 0, andWord: 0, veWord: 0 }

  for (const art of articles) {
    const raw = art.authors_raw?.trim() ?? ''
    if (!raw) {
      emptyAuthors++
      continue
    }
    withAuthors++
    if (raw.includes(',')) delim.comma++
    if (raw.includes(';')) delim.semicolon++
    if (/\band\b/i.test(raw)) delim.andWord++
    if (/\bve\b/i.test(raw)) delim.veWord++

    const tokens = parseAuthorTokens(raw)
    const parsed = tokens.filter((t) => !t.rejected).map((t) => t.display)
    const rejected = tokens.filter((t) => t.rejected)

    if (rejected.length) {
      for (const t of rejected) {
        if (t.rejected === 'insufficient_identity' && insufficient.length < 15) {
          insufficient.push(`id=${art.id}: "${t.display}"`)
        }
        if (t.rejected === 'only_punctuation' && unparseable.length < 15) {
          unparseable.push(`id=${art.id}: "${t.display}" (noktalama)`)
        }
      }
    }

    if (parsed.length === 0) {
      if (unparseable.length < 20) unparseable.push(`id=${art.id}: "${raw.slice(0, 120)}"`)
      continue
    }
    parsedTokens += parsed.length
    maxAuthors = Math.max(maxAuthors, parsed.length)
    if (parsed.length === 1) single++
    else multi++

    for (const name of parsed) {
      rawSet.add(name)
      const nk = normalizeAuthorMatchKey(name)
      const bucket = normToRaw.get(nk) ?? new Set<string>()
      bucket.add(name)
      normToRaw.set(nk, bucket)
    }
  }

  const collisionSamples: AuthorProfileStats['normalizedCollisionSamples'] = []
  let sameNormDiffRaw = 0
  for (const [norm, raws] of normToRaw) {
    if (raws.size > 1) {
      sameNormDiffRaw++
      if (collisionSamples.length < 15) {
        collisionSamples.push({ normalized: norm, rawVariants: [...raws] })
      }
    }
  }

  return {
    totalArticles: articles.length,
    withAuthors,
    emptyAuthors,
    parsedAuthorTokens: parsedTokens,
    uniqueRawNames: rawSet.size,
    uniqueNormalizedNames: normToRaw.size,
    sameNormalizedDifferentRaw: sameNormDiffRaw,
    maxAuthorsPerArticle: maxAuthors,
    singleAuthorArticles: single,
    multiAuthorArticles: multi,
    unparseableSamples: unparseable,
    insufficientIdentitySamples: insufficient,
    delimiterCounts: delim,
    normalizedCollisionSamples: collisionSamples,
  }
}
