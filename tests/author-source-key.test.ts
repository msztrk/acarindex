import { describe, expect, it, vi } from 'vitest'
import {
  articleAuthorSourceKey,
  mysqlAuthorSourceKey,
  normalizeStoredSourceKey,
} from '../lib/etl/author-source-key'
import {
  ensureAuthorsSourceKeyColumn,
  upsertAuthorsBySourceKey,
  fetchAuthorIdsBySourceKey,
} from '../lib/etl/author-upsert'

describe('author source_key format', () => {
  it('canonical source key standardı', () => {
    expect(mysqlAuthorSourceKey(1524)).toBe('mysql-author:1524')
  })

  it('provisional source key standardı', () => {
    expect(articleAuthorSourceKey(2155, 3)).toBe('article:2155:position:3')
  })

  it('100+ pozisyon çakışmaz', () => {
    expect(articleAuthorSourceKey(10, 99)).not.toBe(articleAuthorSourceKey(10, 100))
    expect(articleAuthorSourceKey(10, 100)).toBe('article:10:position:100')
  })

  it('eski formatı normalize eder', () => {
    expect(normalizeStoredSourceKey('mysql_yazarlar:42')).toBe('mysql-author:42')
    expect(normalizeStoredSourceKey('article:12:pos:2')).toBe('article:12:position:2')
  })
})

describe('author upsert source_key', () => {
  it('source_key kolonu yoksa açık hata verir', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          limit: async () => ({ error: { message: 'column authors.source_key does not exist' } }),
        }),
      }),
    }
    await expect(ensureAuthorsSourceKeyColumn(sb as never)).rejects.toThrow('authors.source_key')
  })

  it('upsert onConflict source_key kullanır', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const sb = {
      from: () => ({
        upsert,
      }),
    }

    await upsertAuthorsBySourceKey(sb as never, [
      {
        source_key: 'mysql-author:1',
        legacy_id: 1,
        name: 'Test',
        slug: 'test',
        is_provisional: false,
      },
    ])

    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'source_key' }),
    )
  })

  it('source_key lookup doğru map döner', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          in: async () => ({
            data: [
              { id: 10, source_key: 'mysql-author:10' },
              { id: 11, source_key: 'article:5:position:2' },
            ],
            error: null,
          }),
        }),
      }),
    }

    const map = await fetchAuthorIdsBySourceKey(sb as never, [
      'mysql-author:10',
      'article:5:position:2',
    ])
    expect(map.get('mysql-author:10')).toBe(10)
    expect(map.get('article:5:position:2')).toBe(11)
  })
})

