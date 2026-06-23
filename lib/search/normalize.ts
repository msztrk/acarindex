/** Arama terimi normalizasyonu — Türkçe → ASCII eşdeğer. */
export function normalizeSearchTerm(q: string): string {
  return q
    .replace(/[ğĞ]/g, 'g')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[ıİ]/g, 'i')
}

/** Orijinal ve normalize edilmiş terimlerle eşleşme (Prisma contains). */
export function expandSearchTerms(q: string): string[] {
  const raw = q.trim()
  if (!raw) return []
  const norm = normalizeSearchTerm(raw)
  const terms = new Set<string>([raw])
  if (norm && norm !== raw) terms.add(norm)
  return [...terms]
}
