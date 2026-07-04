import type { JournalApplicationSubjectLevel } from '@prisma/client'

export const KEYWORD_MIN = 3
export const KEYWORD_MAX = 10
export const KEYWORD_MAX_LENGTH = 80

export type KeywordValidationResult =
  | { ok: true; keywords: string[] }
  | { ok: false; error: string }

/** Trim, boş eleman yok, case-insensitive dedupe, uzunluk sınırı. */
export function normalizeJournalKeywords(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.toLocaleLowerCase('tr')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function validateJournalKeywords(raw: string[]): KeywordValidationResult {
  const normalized = normalizeJournalKeywords(raw)
  if (normalized.length < KEYWORD_MIN) {
    return { ok: false, error: `En az ${KEYWORD_MIN} anahtar kelime gerekli.` }
  }
  if (normalized.length > KEYWORD_MAX) {
    return { ok: false, error: `En fazla ${KEYWORD_MAX} anahtar kelime eklenebilir.` }
  }
  for (const kw of normalized) {
    if (kw.length > KEYWORD_MAX_LENGTH) {
      return {
        ok: false,
        error: `Anahtar kelime en fazla ${KEYWORD_MAX_LENGTH} karakter olabilir.`,
      }
    }
  }
  return { ok: true, keywords: normalized }
}

export type SubjectAreaInput = {
  categoryId: bigint
  level: JournalApplicationSubjectLevel
}

export const PRIMARY_SUBJECT_MIN = 1
export const PRIMARY_SUBJECT_MAX = 3

export type SubjectAreaValidationResult =
  | { ok: true; areas: SubjectAreaInput[] }
  | { ok: false; error: string }

export function validateJournalSubjectAreas(areas: SubjectAreaInput[]): SubjectAreaValidationResult {
  if (areas.length === 0) {
    return { ok: false, error: 'En az bir konu alanı seçilmelidir.' }
  }

  const seen = new Set<string>()
  let primaryCount = 0

  for (const area of areas) {
    const key = area.categoryId.toString()
    if (seen.has(key)) {
      return { ok: false, error: 'Aynı kategori tekrar eklenemez.' }
    }
    seen.add(key)
    if (area.level === 'primary') primaryCount++
  }

  if (primaryCount < PRIMARY_SUBJECT_MIN) {
    return { ok: false, error: 'En az bir birincil (primary) konu alanı zorunludur.' }
  }
  if (primaryCount > PRIMARY_SUBJECT_MAX) {
    return { ok: false, error: `En fazla ${PRIMARY_SUBJECT_MAX} birincil konu alanı seçilebilir.` }
  }

  return { ok: true, areas }
}
