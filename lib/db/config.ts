/**
 * Katalog veritabanı backend — fail-closed; varsayılan Supabase fallback yok.
 */
import { CatalogDatabaseConfigError } from './errors'

export type DbBackend = 'prisma'

/** Beta veya production ortamı (Supabase katalog fallback kapalı). */
export function isCatalogStrictEnvironment(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  const site = process.env.NEXT_PUBLIC_SITE_URL?.toLowerCase() ?? ''
  return site.includes('beta.acarindex.com') || site.includes('www.acarindex.com')
}

/** Geçici geliştirici override — yalnızca non-strict ortamda. */
export function isSupabaseCatalogOverride(): boolean {
  return process.env.USE_SUPABASE_DB === '1' && !isCatalogStrictEnvironment()
}

export function requireCatalogDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new CatalogDatabaseConfigError(
      'DATABASE_URL tanımlı değil. Katalog uygulaması standart PostgreSQL (Prisma) gerektirir.',
    )
  }
  if (isSupabaseCatalogOverride()) {
    throw new CatalogDatabaseConfigError(
      'USE_SUPABASE_DB=1 katalog okumaları için kullanılamaz. Yalnızca legacy scriptler için geçici seçenek.',
    )
  }
  return url
}

export function resolveDbBackend(): DbBackend {
  requireCatalogDatabaseUrl()
  return 'prisma'
}

export function isPrismaBackend(): boolean {
  try {
    requireCatalogDatabaseUrl()
    return true
  } catch {
    return false
  }
}
