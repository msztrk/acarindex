/**
 * PDF URL yardımcıları — Faz 1 (legacy sunucu)
 *
 * PHP orijinal (pages/pdfgoruntule/pdfgoruntule.php):
 *   function build_pdf_src($pdfLink) {
 *     if empty or 'pdf-bulunamadi' → return ''
 *     if http(s) → return as-is
 *     ltrim '/' → prefix www base URL
 *   }
 */

const MISSING_SENTINEL = 'pdf-bulunamadi'

/**
 * DB'deki legacy_pdf_path değerinden tam erişilebilir URL üretir.
 * Faz-2'de bu fonksiyon cdn_url'e yönlendirilecek.
 */
export function buildLegacyPdfUrl(legacyPath: string | null | undefined): string | null {
  const base = process.env.LEGACY_FILE_BASE_URL ?? 'https://www.acarindex.com'

  if (!legacyPath) return null
  const path = legacyPath.trim()
  if (path === '' || path === MISSING_SENTINEL) return null

  // Harici URL — olduğu gibi dön
  if (/^https?:\/\//i.test(path)) return path

  // Relative path — base ile birleştir
  return `${base}/${path.replace(/^\/+/, '')}`
}

/**
 * PDF mevcut mu?
 */
export function hasPdf(legacyPath: string | null | undefined): boolean {
  return buildLegacyPdfUrl(legacyPath) !== null
}

/**
 * Makale ID'sinden viewer URL'i (/pdfs/{id})
 */
export function buildPdfViewerUrl(articleId: number): string {
  return `/pdfs/${articleId}`
}
