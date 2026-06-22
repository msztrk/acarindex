import { describe, it, expect } from 'vitest'
import {
  requireDatabaseUrl,
  maskDatabaseUrl,
  assertNoHardcodedConnectionString,
} from '../scripts/lib/database-url'

describe('requireDatabaseUrl', () => {
  it('SUPABASE_DB_URL yokken anlaşılır hata verir', () => {
    const prev = { ...process.env }
    delete process.env.SUPABASE_DB_URL
    delete process.env.DATABASE_URL
    try {
      expect(() => requireDatabaseUrl()).toThrow(/SUPABASE_DB_URL tanımlı değil/)
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

  it('SUPABASE_DB_URL değerini döndürür', () => {
    const prev = { ...process.env }
    process.env.SUPABASE_DB_URL = 'postgresql://user:secret@db.example.com:5432/postgres'
    try {
      expect(requireDatabaseUrl()).toBe(process.env.SUPABASE_DB_URL)
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
