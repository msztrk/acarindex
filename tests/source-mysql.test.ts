import { describe, it, expect } from 'vitest'
import {
  resolveSourceMysqlConfig,
  maskMysqlUrl,
  assertLocalSourceHost,
  requireLocalSourceSqlPath,
} from '../scripts/source/mysql-config'

describe('source mysql configuration', () => {
  it('SOURCE_MYSQL_URL yoksa anlaşılır hata', () => {
    const prev = { ...process.env }
    delete process.env.SOURCE_MYSQL_URL
    delete process.env.MYSQL_HOST
    delete process.env.MYSQL_USER
    delete process.env.MYSQL_DATABASE
    try {
      expect(() => resolveSourceMysqlConfig()).toThrow(/SOURCE_MYSQL_URL tanımlı değil/)
    } finally {
      process.env = prev
    }
  })

  it('hata mesajında parola görünmez', () => {
    const prev = { ...process.env }
    delete process.env.SOURCE_MYSQL_URL
    delete process.env.MYSQL_HOST
    try {
      resolveSourceMysqlConfig()
    } catch (e) {
      expect(String(e)).not.toMatch(/password/i)
      expect(String(e)).not.toMatch(/mysql:\/\//)
    } finally {
      process.env = prev
    }
  })

  it('SOURCE_MYSQL_URL localhost dışı host reddedilir', () => {
    const prev = process.env.SOURCE_MYSQL_URL
    process.env.SOURCE_MYSQL_URL = 'mysql://reader:secret@203.0.113.10:3306/acarindex_source_local'
    try {
      expect(() => resolveSourceMysqlConfig()).toThrow(/localhost/)
    } finally {
      if (prev === undefined) delete process.env.SOURCE_MYSQL_URL
      else process.env.SOURCE_MYSQL_URL = prev
    }
  })

  it('maskMysqlUrl şifreyi gizler', () => {
    const masked = maskMysqlUrl('mysql://user:secret@127.0.0.1:3306/acarindex_source_local')
    expect(masked).not.toContain('secret')
    expect(masked).toContain('***')
  })

  it('LOCAL_SOURCE_SQL_PATH zorunlu when missing', () => {
    const prev = process.env.LOCAL_SOURCE_SQL_PATH
    delete process.env.LOCAL_SOURCE_SQL_PATH
    try {
      expect(() => requireLocalSourceSqlPath()).toThrow(/LOCAL_SOURCE_SQL_PATH/)
    } finally {
      if (prev) process.env.LOCAL_SOURCE_SQL_PATH = prev
    }
  })

  it('assertLocalSourceHost 127.0.0.1 kabul eder', () => {
    expect(() => assertLocalSourceHost('127.0.0.1')).not.toThrow()
  })
})
