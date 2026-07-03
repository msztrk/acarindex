export type NormalizedLanguageCode = 'tr' | 'en' | 'other' | null

const ENGLISH_CODES = new Set([
  'en',
  'eng',
  'english',
  'en-us',
  'en-gb',
])

const TURKISH_CODES = new Set([
  'tr',
  'tur',
  'turkish',
  'türkçe',
  'turkce',
  'tr-tr',
])

function foldForLanguageMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, 'i') // ı → i for turkce matching only
    .replace(/_/g, '-')
}

/** Normalize raw language / document_language values to tr | en | other | null. */
export function normalizeLanguageCode(
  value: string | null | undefined,
): NormalizedLanguageCode {
  if (!value) return null
  const folded = foldForLanguageMatch(value)
  if (!folded) return null

  const primary = folded.split(/[-_]/)[0] ?? folded
  if (ENGLISH_CODES.has(folded) || ENGLISH_CODES.has(primary)) return 'en'
  if (TURKISH_CODES.has(folded) || TURKISH_CODES.has(primary)) return 'tr'

  if (folded.startsWith('en-')) return 'en'
  if (folded.startsWith('tr-')) return 'tr'

  return 'other'
}

export function isEnglishLanguage(value: string | null | undefined): boolean {
  return normalizeLanguageCode(value) === 'en'
}

export function isTurkishLanguage(value: string | null | undefined): boolean {
  return normalizeLanguageCode(value) === 'tr'
}

export function isEnglishDocumentLanguage(
  language?: string | null,
  documentLanguage?: string | null,
): boolean {
  return isEnglishLanguage(documentLanguage) || isEnglishLanguage(language)
}
