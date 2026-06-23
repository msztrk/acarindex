import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  requireCatalogDatabaseUrl,
  resolveDbBackend,
  isCatalogStrictEnvironment,
  isSupabaseCatalogOverride,
} from '../lib/db/config'
import { CatalogDatabaseConfigError } from '../lib/db/errors'

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) delete process.env[key]
  }
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

describe('catalog DB config (fail-closed)', () => {
  let envSnapshot: Record<string, string | undefined>

  beforeEach(() => {
    envSnapshot = { ...process.env }
  })

  afterEach(() => {
    restoreEnv(envSnapshot)
    vi.unstubAllEnvs()
  })

  it('DATABASE_URL yoksa CatalogDatabaseConfigError verir', () => {
    delete process.env.DATABASE_URL
    delete process.env.USE_SUPABASE_DB
    expect(() => requireCatalogDatabaseUrl()).toThrow(CatalogDatabaseConfigError)
    expect(() => requireCatalogDatabaseUrl()).toThrow(/DATABASE_URL tanımlı değil/)
  })

  it('DATABASE_URL varsa Prisma backend döner', () => {
    process.env.DATABASE_URL = 'postgresql://user:secret@127.0.0.1:5432/acarindex_dev'
    delete process.env.USE_SUPABASE_DB
    expect(resolveDbBackend()).toBe('prisma')
  })

  it('USE_SUPABASE_DB=1 katalog okumalarında reddedilir', () => {
    process.env.DATABASE_URL = 'postgresql://user:secret@127.0.0.1:5432/acarindex_dev'
    process.env.USE_SUPABASE_DB = '1'
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(() => requireCatalogDatabaseUrl()).toThrow(/USE_SUPABASE_DB/)
  })

  it('production ortamında strict kabul edilir', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isCatalogStrictEnvironment()).toBe(true)
  })

  it('beta site URL strict ortam sayılır', () => {
    vi.stubEnv('NODE_ENV', 'development')
    process.env.NEXT_PUBLIC_SITE_URL = 'https://beta.acarindex.com'
    expect(isCatalogStrictEnvironment()).toBe(true)
    expect(isSupabaseCatalogOverride()).toBe(false)
  })

  it('hata mesajında connection string sızdırmaz', () => {
    delete process.env.DATABASE_URL
    try {
      requireCatalogDatabaseUrl()
    } catch (e) {
      expect(String(e)).not.toMatch(/postgresql:\/\//)
    }
  })
})
