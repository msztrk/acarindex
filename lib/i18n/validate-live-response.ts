/**
 * Strict parsers for Next.js App Router soft redirect / soft 404 responses.
 * Used by validate-i18n-urls.ts — do not treat arbitrary HTTP 200 as success.
 */

export const NEXT_SOFT_REDIRECT_RE = /NEXT_REDIRECT;(replace|push);([^;]+);(\d+);/
export const NEXT_SOFT_404_RE = /NEXT_HTTP_ERROR_FALLBACK;404/

export type ParsedSoftRedirect = {
  kind: 'replace' | 'push'
  targetPath: string
  statusCode: number
}

export function parseSoftRedirect(body: string): ParsedSoftRedirect | null {
  const match = body.match(NEXT_SOFT_REDIRECT_RE)
  if (!match) return null
  const statusCode = Number(match[3])
  if (!Number.isFinite(statusCode)) return null
  const targetPath = match[2]?.trim()
  if (!targetPath || !targetPath.startsWith('/')) return null
  return { kind: match[1] as 'replace' | 'push', targetPath, statusCode }
}

export function isAcceptedRedirectStatus(statusCode: number): boolean {
  return statusCode === 302 || statusCode === 307 || statusCode === 308
}

/** Soft redirect to TR canonical path (strict; not mere substring match). */
export function validateSoftRedirectToTr(
  body: string,
  enPath: string,
  trPath: string,
): boolean {
  const parsed = parseSoftRedirect(body)
  if (!parsed) return false
  if (!isAcceptedRedirectStatus(parsed.statusCode)) return false
  if (parsed.targetPath.includes('/en/')) return false
  if (parsed.targetPath !== trPath) return false
  if (parsed.targetPath === enPath) return false
  return true
}

export function validateHttpRedirectToTr(
  status: number,
  location: string | null,
  trPath: string,
  enPath: string,
): boolean {
  if (!isAcceptedRedirectStatus(status) || !location) return false
  const normalized = location.startsWith('http') ? new URL(location).pathname : location
  if (normalized.includes('/en/')) return false
  if (normalized !== trPath && !normalized.endsWith(trPath)) return false
  if (normalized === enPath) return false
  return true
}

/** Next.js not-found digest plus known article 404 page markers. */
export function validateSoft404(body: string): boolean {
  if (!NEXT_SOFT_404_RE.test(body)) return false
  return body.includes('Makale bulunamadı') || body.includes('data-page-404')
}

export function hasAnySoftRedirect(body: string): boolean {
  return parseSoftRedirect(body) !== null
}
