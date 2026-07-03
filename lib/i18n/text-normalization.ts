const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#160': ' ',
}

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g

/** Remove HTML tags (best-effort, not a full sanitizer). */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
}

/** Decode common named and numeric HTML entities. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    const key = entity.toLowerCase()
    if (HTML_ENTITY_MAP[key] != null) return HTML_ENTITY_MAP[key]!
    if (key.startsWith('#x')) {
      const code = parseInt(key.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (key.startsWith('#')) {
      const code = parseInt(key.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return match
  })
}

export function normalizeWhitespace(value: string): string {
  return value.replace(ZERO_WIDTH_RE, '').replace(/\s+/g, ' ').trim()
}

/** Lowercase + strip punctuation runs for TR/EN sameness checks (Turkish chars preserved). */
export function normalizeComparableText(value: string | null | undefined): string {
  if (!value) return ''
  const cleaned = normalizeWhitespace(decodeHtmlEntities(stripHtml(value)))
  if (!cleaned) return ''
  return cleaned
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getMeaningfulTextLength(value: string | null | undefined): number {
  if (!value) return 0
  const cleaned = normalizeWhitespace(decodeHtmlEntities(stripHtml(value)))
  if (!cleaned) return 0
  const withoutPunctuation = cleaned.replace(/[^\p{L}\p{N}]+/gu, '').trim()
  return withoutPunctuation.length
}

export function isPunctuationOnly(value: string): boolean {
  const cleaned = normalizeWhitespace(decodeHtmlEntities(stripHtml(value)))
  if (!cleaned) return true
  return /^[\p{P}\p{S}\s\-–—]+$/u.test(cleaned)
}

export function hasMeaningfulText(
  value: string | null | undefined,
  minimumLength = 10,
): boolean {
  if (!value) return false
  const raw = value.trim()
  if (!raw) return false
  if (isPunctuationOnly(raw)) return false
  return getMeaningfulTextLength(raw) >= minimumLength
}

export function areComparableTextsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeComparableText(a)
  const nb = normalizeComparableText(b)
  if (!na || !nb) return false
  return na === nb
}
