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
