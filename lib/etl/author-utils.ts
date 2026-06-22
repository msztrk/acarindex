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

/** Gösterim adı: trim, boşluk birleştirme, kenar noktalama; Türkçe karakterler korunur. */
export function normalizeAuthorDisplayName(name: string): string {
  return decodeHtmlEntities(name)
    .replace(/^[^a-zA-ZçğıöşüÇĞİÖŞÜ]+/, '')
    .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
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
      /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(curr) &&
      !/^[A-Za-zÇĞİÖŞÜçğıöşü]\.?$/.test(curr)
    ) {
      result.push(`${curr}, ${next}`)
      i += 2
    } else if (curr.length >= 2) {
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

/**
 * Yazar listesini ayrıştırır. Önce noktalı virgül, sonra virgül (Soyad, Ad birleştirme ile).
 */
export function parseAuthorList(raw: string | null | undefined): string[] {
  if (!raw) return []
  const cleaned = decodeHtmlEntities(raw).trim()
  if (!cleaned) return []

  const segments = cleaned
    .split(';')
    .flatMap((seg) => splitCommaSegment(seg))

  const seen = new Set<string>()
  const out: string[] = []
  for (const seg of segments) {
    const display = normalizeAuthorDisplayName(seg)
    if (display.length < 2 || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(display)) continue
    const key = normalizeAuthorMatchKey(display)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(display)
  }
  return out
}

/** mysql yazarlar.id için güvenilir kaynak kimliği. */
export function yazarlarLegacyId(yazarlarId: number): number {
  return yazarlarId
}

/**
 * Kaynak yazar ID yoksa makale+pozisyon bazlı provisional legacy_id.
 * Negatif değerler yazarlar.id (pozitif) ile çakışmaz.
 */
export function provisionalLegacyId(articleId: number, position: number): number {
  const packed = articleId * 100 + position
  if (packed > 2_147_483_647) {
    throw new Error(`provisionalLegacyId overflow: article=${articleId} pos=${position}`)
  }
  return -packed
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
  delimiterCounts: { comma: number; semicolon: number; andWord: number; veWord: number }
  normalizedCollisionSamples: Array<{ normalized: string; rawVariants: string[] }>
}

export interface ArticleAuthorRow {
  id: number
  authors_raw: string | null
  status?: string | null
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

    const parsed = parseAuthorList(raw)
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
    delimiterCounts: delim,
    normalizedCollisionSamples: collisionSamples,
  }
}
