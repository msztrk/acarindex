import { describe, it, expect } from 'vitest'
import {
  requireDatabaseUrl,
  maskDatabaseUrl,
  assertNoHardcodedConnectionString,
} from '../scripts/lib/database-url'

describe('requireDatabaseUrl', () => {
  it('DATABASE_URL yokken anlaşılır hata verir', () => {
    const prev = { ...process.env }
    delete process.env.SUPABASE_DB_URL
    delete process.env.DATABASE_URL
    try {
      expect(() => requireDatabaseUrl()).toThrow(/DATABASE_URL tanımlı değil/)
    } finally {
      process.env = prev
    }
  })

  it('hata mesajında secret göstermez', () => {
    const prev = { ...process.env }
    delete process.env.SUPABASE_DB_URL
    delete process.env.DATABASE_URL
    try {
      requireDatabaseUrl()
    } catch (e) {
      expect(String(e)).not.toMatch(/postgresql:\/\//)
      expect(String(e)).not.toMatch(/postgres:/)
    } finally {
      process.env = prev
    }
  })

  it('DATABASE_URL öncelikli döndürülür', () => {
    const prev = { ...process.env }
    process.env.DATABASE_URL = 'postgresql://user:secret@127.0.0.1:5432/acarindex_dev'
    process.env.SUPABASE_DB_URL = 'postgresql://user:other@db.example.com:5432/postgres'
    try {
      expect(requireDatabaseUrl()).toBe(process.env.DATABASE_URL)
    } finally {
      process.env = prev
    }
  })

  it('production fallback yok — yalnızca env', () => {
    const prev = { ...process.env }
    delete process.env.SUPABASE_DB_URL
    delete process.env.DATABASE_URL
    try {
      expect(() => requireDatabaseUrl()).toThrow()
    } finally {
      process.env = prev
    }
  })
})

describe('maskDatabaseUrl', () => {
  it('şifreyi maskeler', () => {
    const masked = maskDatabaseUrl('postgresql://postgres:secret@db.host.supabase.co:5432/postgres')
    expect(masked).toContain('postgresql://')
    expect(masked).not.toContain('secret')
    expect(masked).toMatch(/\*\*\*/)
  })
})

describe('assertNoHardcodedConnectionString', () => {
  it('inline supabase postgres URL reddeder', () => {
    expect(() =>
      assertNoHardcodedConnectionString(
        'postgresql://postgres:pwd@db.abcdefghij.supabase.co:5432/postgres',
      ),
    ).toThrow(/Hardcoded/)
  })
})
