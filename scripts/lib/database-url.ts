/**
 * Postgres bağlantı URL'si — yalnızca ortam değişkeninden.
 * Birincil: DATABASE_URL (standart PostgreSQL).
 * Legacy: SUPABASE_DB_URL (geçici geri uyumluluk).
 */

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL tanımlı değil. Standart PostgreSQL bağlantısını ortam değişkeni üzerinden sağlayın.',
    )
  }
  return url
}

/** Raporlama için maskeli URL: postgresql://user:***@host/database */
export function maskDatabaseUrl(connectionString: string): string {
  try {
    const parsed = new URL(connectionString)
    if (parsed.username) parsed.username = '***'
    if (parsed.password) parsed.password = '***'
    return parsed.toString()
  } catch {
    return 'postgresql://***:***@***/***'
  }
}

/** Hardcoded credential pattern (password kısmı hariç host eşleşmesi). */
export const HARDCODED_DB_HOST_PATTERN = /@db\.[a-z0-9]+\.supabase\.co/i

export function assertNoHardcodedConnectionString(value: string): void {
  if (HARDCODED_DB_HOST_PATTERN.test(value) && value.includes('://postgres:')) {
    throw new Error('Hardcoded Supabase Postgres bağlantı dizisi kullanılamaz')
  }
}
