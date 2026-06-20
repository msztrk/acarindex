/**
 * ETL pure utility fonksiyonları
 * Hem ETL scriptleri hem de unit testler tarafından kullanılır.
 */

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
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(s))
}

/**
 * Yazar adını normalize eder:
 * - Baştaki/sondaki boşluk ve noktalama temizlenir
 * - Birden fazla boşluk → tekil
 * - 2 karakterden kısa adlar geçersiz
 */
export function normalizeAuthorName(name: string): string {
  return name
    .replace(/^[^a-zA-ZçğıöşüÇĞİÖŞÜ]+/, '')
    .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}
