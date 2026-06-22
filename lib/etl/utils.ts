/**
 * ETL pure utility fonksiyonları
 * Hem ETL scriptleri hem de unit testler tarafından kullanılır.
 */

import { parseAuthorList, normalizeAuthorDisplayName } from './author-utils'

/**
 * "1-15", "12–20", "7" gibi formatları parse eder.
 */
export function parsePages(raw: string | null | undefined): { start: number | null; end: number | null } {
  if (!raw || raw.trim() === '') return { start: null, end: null }
  const trimmed = raw.trim()

  // "1-15" veya "1–15" (em dash)
  const rangeMatch = trimmed.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
  if (rangeMatch) {
    return { start: parseInt(rangeMatch[1], 10), end: parseInt(rangeMatch[2], 10) }
  }

  // Tek sayı
  const single = parseInt(trimmed, 10)
  if (!isNaN(single) && String(single) === trimmed) {
    return { start: single, end: null }
  }

  return { start: null, end: null }
}

/**
 * Virgülle ayrılmış yazar string'ini listeye çevirir.
 * Boş, sadece boşluk veya sadece noktalama içeren isimleri filtreler.
 */
export function parseAuthors(raw: string | null | undefined): string[] {
  return parseAuthorList(raw)
}

/**
 * Yazar adını normalize eder (gösterim adı).
 */
export function normalizeAuthorName(name: string): string {
  return normalizeAuthorDisplayName(name)
}
