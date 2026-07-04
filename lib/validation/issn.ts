/**
 * ISSN doğrulama — Faz B1 taslak; tam kurallar Faz B2'de uygulanır.
 */
export type IssnValidationResult =
  | { ok: true; normalized: string; formatted: string }
  | { ok: false; error: string }

export function normalizeIssn(value: string | null | undefined): string | null {
  if (value == null) return null
  const digits = value.replace(/[^0-9Xx]/g, '').toUpperCase()
  if (digits.length !== 8) return null
  return digits
}

export function formatIssn(normalized: string): string {
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
}

export function validateIssnCheckDigit(normalized: string): boolean {
  if (!/^[0-9]{7}[0-9X]$/.test(normalized)) return false
  let sum = 0
  for (let i = 0; i < 7; i++) {
    sum += Number(normalized[i]) * (8 - i)
  }
  const remainder = 11 - (sum % 11)
  const check = remainder === 10 ? 'X' : String(remainder === 11 ? 0 : remainder)
  return check === normalized[7]
}

export function isValidIssn(value: string | null | undefined): boolean {
  const normalized = normalizeIssn(value)
  if (!normalized) return false
  return validateIssnCheckDigit(normalized)
}

export function validateIssn(value: string | null | undefined): IssnValidationResult {
  const normalized = normalizeIssn(value)
  if (!normalized) {
    return { ok: false, error: 'ISSN XXXX-XXXX formatında 8 karakter olmalıdır.' }
  }
  if (!validateIssnCheckDigit(normalized)) {
    return { ok: false, error: 'ISSN kontrol basamağı geçersiz.' }
  }
  return { ok: true, normalized, formatted: formatIssn(normalized) }
}

/** Faz B2: en az biri zorunlu; aynı olamaz. */
export function validateIssnPair(
  pIssn: string | null | undefined,
  eIssn: string | null | undefined,
): { ok: true; pIssn: string | null; eIssn: string | null } | { ok: false; error: string } {
  const p = pIssn ? validateIssn(pIssn) : null
  const e = eIssn ? validateIssn(eIssn) : null

  if (p && !p.ok) return p
  if (e && !e.ok) return e
  if (!p && !e) {
    return { ok: false, error: 'P-ISSN veya E-ISSN alanlarından en az biri zorunludur.' }
  }
  if (p?.ok && e?.ok && p.normalized === e.normalized) {
    return { ok: false, error: 'P-ISSN ve E-ISSN aynı olamaz.' }
  }
  return {
    ok: true,
    pIssn: p?.ok ? p.normalized : null,
    eIssn: e?.ok ? e.normalized : null,
  }
}
