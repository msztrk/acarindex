import { describe, it, expect } from 'vitest'
import {
  assertSourceMysqlUrl,
  assertTargetPostgresUrl,
  assertSourceTargetSeparated,
  validateEtlConnections,
} from '../scripts/lib/etl-guard'

describe('etl-guard', () => {
  it('kaynak mysql şeması kabul edilir', () => {
    const s = assertSourceMysqlUrl('mysql://reader:pass@127.0.0.1:3306/acarindex_source')
    expect(s.engine).toBe('mysql')
    expect(s.host).toBe('127.0.0.1')
  })

  it('hedef postgres şeması kabul edilir', () => {
    const t = assertTargetPostgresUrl('postgresql://app:pass@127.0.0.1:5432/acarindex_dev')
    expect(t.engine).toBe('postgresql')
  })

  it('production host reddedilir', () => {
    expect(() =>
      assertTargetPostgresUrl('postgresql://u:p@db.abcdef.supabase.co:5432/postgres'),
    ).toThrow(/production/)
  })

  it('kaynak ve hedef ayrı motor olmalı', () => {
    const source = assertSourceMysqlUrl('mysql://r@127.0.0.1:3306/src')
    const target = assertTargetPostgresUrl('postgresql://a@127.0.0.1:5432/dst')
    assertSourceTargetSeparated(source, target)
    expect(() => validateEtlConnections('mysql://r@127.0.0.1:3306/src', 'postgresql://a@127.0.0.1:5432/dst')).not.toThrow()
  })
})
