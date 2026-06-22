/**
 * Author ETL unit tests — idempotency, parsing, dry-run, resume mantığı.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  decodeHtmlEntities,
  normalizeAuthorDisplayName,
  normalizeAuthorMatchKey,
  parseAuthorList,
  provisionalLegacyId,
  buildYazarlarRegistry,
  profileAuthorSource,
} from '../lib/etl/author-utils'
import {
  planAuthorsForArticle,
  runAuthorsEtl,
  parseAuthorEtlCliArgs,
  createAuthorEtlCounters,
  AuthorEtlErrorType,
} from '../lib/etl/run-authors-etl'

describe('author parsing & normalization', () => {
  it('Türkçe karakterli isim korunur', () => {
    expect(normalizeAuthorDisplayName('İbrahim Çelik')).toBe('İbrahim Çelik')
    expect(parseAuthorList('İbrahim Çelik')).toEqual(['İbrahim Çelik'])
  })

  it('HTML entity temizlenir', () => {
    expect(decodeHtmlEntities('Ahmet&amp; Mehmet')).toBe('Ahmet& Mehmet')
    expect(normalizeAuthorDisplayName('Fatma&#231;')).toBe('Fatmaç')
  })

  it('boş yazar atlanır', () => {
    expect(parseAuthorList('  ,  ,')).toEqual([])
  })

  it('noktalı virgül ayırır', () => {
    expect(parseAuthorList('Ahmet YILMAZ; Mehmet DEMİR')).toEqual(['Ahmet YILMAZ', 'Mehmet DEMİR'])
  })

  it('Soyad, Ad birleştirir (ters çevirme yapmaz)', () => {
    const parsed = parseAuthorList('AKÇA, Yavuz DEMİREL')
    expect(parsed).toEqual(['AKÇA, Yavuz DEMİREL'])
  })

  it('virgül boşluksuz çoklu yazar', () => {
    expect(parseAuthorList('Mutlu SESLİ,Şeyhmus DEMİR')).toEqual(['Mutlu SESLİ', 'Şeyhmus DEMİR'])
  })
})

describe('author identity', () => {
  it('farklı makale aynı ada sahip provisional ayrı legacy_id', () => {
    const reg = buildYazarlarRegistry([])
    const a1 = planAuthorsForArticle({ id: 10, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    const a2 = planAuthorsForArticle({ id: 20, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    expect(a1.authors[0].legacyId).not.toBe(a2.authors[0].legacyId)
    expect(a1.authors[0].isProvisional).toBe(true)
  })

  it('mysql yazarlar tek eşleşmede güvenilir ID kullanır', () => {
    const reg = buildYazarlarRegistry([{ id: 42, yazar: 'Ahmet GÜVEN' }])
    const r = planAuthorsForArticle({ id: 10, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    expect(r.authors[0].legacyId).toBe(42)
    expect(r.authors[0].isProvisional).toBe(false)
  })

  it('belirsiz yazarlar eşleşmesinde provisional kalır', () => {
    const reg = buildYazarlarRegistry([
      { id: 1, yazar: 'Ahmet GÜVEN' },
      { id: 2, yazar: 'Ahmet GÜVEN' },
    ])
    const r = planAuthorsForArticle({ id: 10, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    expect(r.authors[0].isProvisional).toBe(true)
    expect(r.authors[0].legacyId).toBe(provisionalLegacyId(10, 1))
  })

  it('author position korunur', () => {
    const reg = buildYazarlarRegistry([])
    const r = planAuthorsForArticle(
      { id: 5, authors_raw: 'A Yazar, B Yazar, C Yazar' },
      reg,
      false,
    )
    expect(r.authors.map((a) => a.position)).toEqual([1, 2, 3])
  })
})

describe('runAuthorsEtl', () => {
  function mockSb() {
    const authors: Array<Record<string, unknown>> = []
    const relations: Array<Record<string, unknown>> = []
    let authorSeq = 100

    const sb = {
      from(table: string) {
        const api = {
          select: () => api,
          gt: () => api,
          eq: () => api,
          order: () => api,
          limit: () => api,
          range: () => api,
          not: () => api,
          in: () => api,
          upsert: async (rows: Record<string, unknown>[], opts?: { onConflict?: string }) => {
            if (table === 'authors') {
              for (const row of rows) {
                const existing = authors.find((a) => a.legacy_id === row.legacy_id)
                if (!existing) {
                  const id = authorSeq++
                  authors.push({ ...row, id })
                }
              }
              return { error: null }
            }
            if (table === 'article_authors') {
              for (const row of rows) {
                const dup = relations.find(
                  (r) => r.article_id === row.article_id && r.author_id === row.author_id,
                )
                if (!dup) relations.push(row)
              }
              return { error: null }
            }
            return { error: null }
          },
        }
        const chain = {
          ...api,
          select: () => chain,
          gt: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          not: () => chain,
          in: () => chain,
          range: () => chain,
        }
        if (table === 'articles') {
          Object.assign(chain, {
            then(resolve: (v: unknown) => void) {
              resolve({ data: [], error: null })
            },
          })
        } else if (table === 'authors') {
          Object.assign(chain, {
            then(resolve: (v: unknown) => void) {
              resolve({ data: authors.map((a) => ({ id: a.id, legacy_id: a.legacy_id })), error: null })
            },
          })
        } else {
          Object.assign(chain, {
            then(resolve: (v: unknown) => void) {
              resolve({ data: [], error: null })
            },
          })
        }
        return chain
      },
    }

    return { sb, authors, relations }
  }

  it('dry-run yazma yapmaz', async () => {
    const articles = [{ id: 1, authors_raw: 'Test Yazar', status: 'published' }]
    const sb = {
      from(table: string) {
        const chain = {
          select: () => chain,
          gt: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          upsert: vi.fn(),
        }
        if (table === 'articles') {
          Object.assign(chain, {
            then(resolve: (v: unknown) => void) {
              resolve({ data: articles, error: null })
            },
          })
        }
        return chain
      },
    }

    await runAuthorsEtl({
      sb: sb as never,
      registry: buildYazarlarRegistry([]),
      cli: {
        dryRun: true,
        profileOnly: false,
        limit: 10,
        startAfter: 0,
        batchSize: 10,
        skipNonPublished: true,
      },
    })

    expect(sb.from('authors').upsert).not.toHaveBeenCalled()
  })

  it('aynı kaynak yazar ikinci kez oluşturulmuyor', async () => {
    const articles = [
      { id: 1, authors_raw: 'Yazar A', status: 'published' },
      { id: 2, authors_raw: 'Yazar A', status: 'published' },
    ]
    let call = 0
    const { sb, authors } = mockSb()

    const customSb = {
      from(table: string) {
        if (table === 'articles') {
          const chain = {
            select: () => chain,
            gt: () => chain,
            eq: () => chain,
            order: () => chain,
            limit: () => chain,
            then(resolve: (v: unknown) => void) {
              const batch = call === 0 ? [articles[0]] : call === 1 ? [articles[1]] : []
              call++
              resolve({ data: batch, error: null })
            },
          }
          return chain
        }
        return sb.from(table)
      },
    }

    const registry = buildYazarlarRegistry([])
    const existing = new Set<number>()

    await runAuthorsEtl({
      sb: customSb as never,
      registry,
      cli: { dryRun: false, profileOnly: false, limit: 2, startAfter: 0, batchSize: 1, skipNonPublished: true },
      existingLegacyIds: existing,
      existingRelations: new Set(),
    })

    const provisionalIds = authors.filter((a) => (a.legacy_id as number) < 0)
    expect(provisionalIds.length).toBe(2)
    expect(authors.length).toBe(2)
  })

  it('veritabanı hatası başarı olarak raporlanmıyor', async () => {
    const articles = [{ id: 1, authors_raw: 'Fail Yazar', status: 'published' }]
    const sb = {
      from(table: string) {
        const chain = {
          select: () => chain,
          gt: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          upsert: async () => ({ error: { message: 'db down' } }),
          then(resolve: (v: unknown) => void) {
            if (table === 'articles') resolve({ data: articles, error: null })
            else resolve({ data: [], error: null })
          },
        }
        return chain
      },
    }

    await expect(
      runAuthorsEtl({
        sb: sb as never,
        registry: buildYazarlarRegistry([]),
        cli: { dryRun: false, profileOnly: false, limit: 1, startAfter: 0, batchSize: 1, skipNonPublished: true },
      }),
    ).rejects.toThrow('authors upsert batch failed')
  })
})

describe('CLI & profile', () => {
  it('parseAuthorEtlCliArgs limit ve batch-size', () => {
    const cli = parseAuthorEtlCliArgs(['--dry-run', '--limit=1000', '--start-after=500', '--batch-size=250'])
    expect(cli.dryRun).toBe(true)
    expect(cli.limit).toBe(1000)
    expect(cli.startAfter).toBe(500)
    expect(cli.batchSize).toBe(250)
  })

  it('profileAuthorSource delimiter sayıları', () => {
    const stats = profileAuthorSource([
      { id: 1, authors_raw: 'A; B, C' },
      { id: 2, authors_raw: '' },
    ])
    expect(stats.withAuthors).toBe(1)
    expect(stats.emptyAuthors).toBe(1)
    expect(stats.delimiterCounts.semicolon).toBe(1)
    expect(stats.delimiterCounts.comma).toBe(1)
  })

  it('boş yazar makale raporlanır', () => {
    const counters = createAuthorEtlCounters()
    const reg = buildYazarlarRegistry([])
    const r = planAuthorsForArticle({ id: 1, authors_raw: '   ', status: 'published' }, reg, false)
    expect(r.errorType).toBe(AuthorEtlErrorType.EMPTY_AUTHOR_TEXT)
    expect(r.skipped).toBe(true)
    if (r.errorType) counters.errorsByType[r.errorType] = 1
    expect(counters.errorsByType.empty_author_text).toBe(1)
  })
})

describe('resume', () => {
  it('start-after sonrası makaleleri işler', async () => {
    const articles = [
      { id: 100, authors_raw: 'Z Yazar', status: 'published' },
      { id: 200, authors_raw: 'W Yazar', status: 'published' },
    ]
    const sb = {
      from(table: string) {
        const chain = {
          select: () => chain,
          gt: (_col: string, val: number) => {
            chain._gt = val
            return chain
          },
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          upsert: async () => ({ error: null }),
          _gt: 0,
          then(resolve: (v: unknown) => void) {
            if (table === 'articles') {
              const filtered = articles.filter((a) => a.id > chain._gt)
              resolve({ data: filtered, error: null })
            } else if (table === 'authors') {
              resolve({ data: [], error: null })
            } else {
              resolve({ data: [], error: null })
            }
          },
        }
        return chain
      },
    }

    const result = await runAuthorsEtl({
      sb: sb as never,
      registry: buildYazarlarRegistry([]),
      cli: {
        dryRun: true,
        profileOnly: false,
        limit: 10,
        startAfter: 150,
        batchSize: 10,
        skipNonPublished: true,
      },
    })

    expect(result.counters.articlesProcessed).toBe(1)
    expect(result.lastArticleId).toBe(200)
  })
})
