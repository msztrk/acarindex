import { describe, it, expect } from 'vitest'
import {
  mysqlAuthorSourceKey,
  articleAuthorSourceKey,
  normalizeStoredSourceKey,
} from '../lib/etl/author-source-key'

describe('author source keys', () => {
  it('canonical mysql-author format', () => {
    expect(mysqlAuthorSourceKey(1524)).toBe('mysql-author:1524')
  })

  it('provisional article:position format', () => {
    expect(articleAuthorSourceKey(2155, 3)).toBe('article:2155:position:3')
  })

  it('100+ position çakışmaz', () => {
    const a = articleAuthorSourceKey(100, 100)
    const b = articleAuthorSourceKey(101, 99)
    expect(a).not.toBe(b)
    expect(a).toBe('article:100:position:100')
  })

  it('eski formatları normalize eder', () => {
    expect(normalizeStoredSourceKey('mysql_yazarlar:42')).toBe('mysql-author:42')
    expect(normalizeStoredSourceKey('article:10:pos:2')).toBe('article:10:position:2')
  })

  it('deterministik', () => {
    expect(articleAuthorSourceKey(1, 1)).toBe(articleAuthorSourceKey(1, 1))
  })
})
