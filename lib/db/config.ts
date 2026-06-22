/**
 * Veritabanı backend seçimi — Supabase SDK yerine standart PostgreSQL (Prisma).
 */
export type DbBackend = 'prisma' | 'supabase'

/** DATABASE_URL tanımlı ve USE_SUPABASE_DB=1 değilse Prisma kullan. */
export function resolveDbBackend(): DbBackend {
  const forceSupabase = process.env.USE_SUPABASE_DB === '1'
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())
  if (hasDatabaseUrl && !forceSupabase) return 'prisma'
  return 'supabase'
}

export function isPrismaBackend(): boolean {
  return resolveDbBackend() === 'prisma'
}
