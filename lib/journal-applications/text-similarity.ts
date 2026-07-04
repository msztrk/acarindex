const STRONG_NAME_SIMILARITY = 0.85
const WEAK_NAME_SIMILARITY = 0.65

export function normalizeJournalName(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 0–1 arası token Jaccard benzerliği. */
export function journalNameSimilarity(a: string, b: string): number {
  const na = normalizeJournalName(a)
  const nb = normalizeJournalName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const tokensA = na.split(' ').filter(Boolean)
  const tokensB = new Set(nb.split(' ').filter(Boolean))
  if (tokensA.length === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++
  }
  return (2 * intersection) / (tokensA.length + tokensB.size)
}

export function isStrongNameSimilarity(score: number): boolean {
  return score >= STRONG_NAME_SIMILARITY
}

export function isWeakNameSimilarity(score: number): boolean {
  return score >= WEAK_NAME_SIMILARITY
}

export function normalizePublisherText(value: string | null | undefined): string {
  if (!value) return ''
  return normalizeJournalName(value)
}

export function publisherSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizePublisherText(a)
  const nb = normalizePublisherText(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.8
  return journalNameSimilarity(na, nb)
}
