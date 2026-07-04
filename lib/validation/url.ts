/**
 * Harici URL doğrulama — SSRF-safe: sunucudan fetch yapılmaz.
 */
export type UrlValidationResult =
  | { ok: true; normalized: string; hostname: string; domain: string }
  | { ok: false; error: string }

function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

export function normalizeExternalUrl(value: string): UrlValidationResult {
  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: false, error: 'URL boş olamaz.' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'URL formatı geçersiz.' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL yalnızca http veya https olabilir.' }
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL kullanıcı adı veya parola içeremez.' }
  }

  if (!parsed.hostname) {
    return { ok: false, error: 'URL hostname içermelidir.' }
  }

  const hostname = stripWww(parsed.hostname)
  const domain = hostname.includes('.') ? hostname.split('.').slice(-2).join('.') : hostname

  parsed.hash = ''
  const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/+$/, '') || ''}${parsed.search}`

  return { ok: true, normalized, hostname, domain }
}

export function validateOptionalExternalUrl(
  value: string | null | undefined,
): UrlValidationResult | { ok: true; normalized: null; hostname: null; domain: null } {
  if (value == null || value.trim() === '') {
    return { ok: true, normalized: null, hostname: null, domain: null }
  }
  return normalizeExternalUrl(value)
}

/** Platform eşleşmesi için path + hostname (query hariç). */
export function normalizePlatformUrlKey(value: string): string | null {
  const result = normalizeExternalUrl(value)
  if (!result.ok) return null
  try {
    const u = new URL(result.normalized)
    const host = stripWww(u.hostname)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${host}${path}`.toLowerCase()
  } catch {
    return null
  }
}

export function validateExternalUrlFields(
  fields: Record<string, string | null | undefined>,
): { ok: true } | { ok: false; field: string; error: string } {
  for (const [field, value] of Object.entries(fields)) {
    if (value == null || value.trim() === '') continue
    const result = normalizeExternalUrl(value)
    if (!result.ok) {
      return { ok: false, field, error: result.error }
    }
  }
  return { ok: true }
}
