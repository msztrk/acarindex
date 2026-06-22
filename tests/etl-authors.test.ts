/**
 * Author ETL unit tests — idempotency, parsing, dry-run, resume, reconcile.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  decodeHtmlEntities,
  normalizeAuthorDisplayName,
  parseAuthorList,
  parseAuthorTokens,
  provisionalLegacyId,
  buildYazarlarRegistry,
  isInsufficientIdentity,
  classifyCommaAuthorSample,
} from '../lib/etl/author-utils'
import { mysqlAuthorSourceKey, articleAuthorSourceKey } from '../lib/etl/author-source-key'
import {
  planAuthorsForArticle,
  runAuthorsEtl,
  parseAuthorEtlCliArgs,
  createAuthorEtlCounters,
  AuthorEtlErrorType,
  processArticleAuthors,
} from '../lib/etl/run-authors-etl'
import {
  classifyArticleCoverage,
  wouldCheckpointSkipArticle,
  buildReconcileReport,
} from '../lib/etl/author-reconcile'

const baseCli = {
  dryRun: false,
  profileOnly: false,
  missingOnly: false,
  reconcile: false,
  limit: 10,
  startAfter: 0,
  batchSize: 10,
  skipNonPublished: true,
}

describe('author parsing & normalization', () => {
  it('Türkçe karakterli isim korunur', () => {
    expect(normalizeAuthorDisplayName('İbrahim Çelik')).toBe('İbrahim Çelik')
    expect(parseAuthorList('İbrahim Çelik')).toEqual(['İbrahim Çelik'])
  })

  it('Kiril isim parse ediliyor', () => {
    expect(parseAuthorList('Александр Иванов')).toEqual(['Александр Иванов'])
  })

  it('Arapça isim parse ediliyor', () => {
    expect(parseAuthorList('محمد أحمد')).toEqual(['محمد أحمد'])
  })

  it('Yunanca isim parse ediliyor', () => {
    expect(parseAuthorList('Γεώργιος Παπαδόπουλος')).toEqual(['Γεώργιος Παπαδόπουλος'])
  })

  it('aksanlı Latin isim korunuyor', () => {
    expect(parseAuthorList('Željko Petrović')).toEqual(['Željko Petrović'])
  })

  it('A. Yılmaz kabul edilir', () => {
    expect(parseAuthorList('A. Yılmaz')).toEqual(['A. Yılmaz'])
  })

  it('B. yetersiz kimlik olarak işaretlenir', () => {
    const tokens = parseAuthorTokens('B.')
    expect(tokens[0]?.rejected).toBe('insufficient_identity')
    expect(parseAuthorList('B.')).toEqual([])
    expect(isInsufficientIdentity('B.')).toBe(true)
  })

  it('yalnızca noktalama atlanır', () => {
    expect(parseAuthorList('..., ---')).toEqual([])
  })

  it('HTML entity temizlenir', () => {
    expect(decodeHtmlEntities('Ahmet&amp; Mehmet')).toBe('Ahmet& Mehmet')
    expect(normalizeAuthorDisplayName('Fatma&#231;')).toBe('Fatmaç')
  })

  it('Soyad, Ad birleştirir', () => {
    expect(parseAuthorList('AKÇA, Yavuz DEMİREL')).toEqual(['AKÇA, Yavuz DEMİREL'])
  })

  it('provisional source key deterministik', () => {
    expect(articleAuthorSourceKey(100, 2)).toBe('article:100:position:2')
    expect(articleAuthorSourceKey(100, 2)).toBe(articleAuthorSourceKey(100, 2))
  })
})

describe('author identity', () => {
  it('farklı makale aynı ada sahip provisional ayrı legacy_id', () => {
    const reg = buildYazarlarRegistry([])
    const a1 = planAuthorsForArticle({ id: 10, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    const a2 = planAuthorsForArticle({ id: 20, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    expect(a1.authors[0].legacyId).not.toBe(a2.authors[0].legacyId)
    expect(a1.authors[0].sourceKey).not.toBe(a2.authors[0].sourceKey)
  })

  it('mysql yazarlar tek eşleşmede güvenilir ID kullanır', () => {
    const reg = buildYazarlarRegistry([{ id: 42, yazar: 'Ahmet GÜVEN' }])
    const r = planAuthorsForArticle({ id: 10, authors_raw: 'Ahmet GÜVEN' }, reg, false)
    expect(r.authors[0].legacyId).toBe(42)
    expect(r.authors[0].sourceKey).toBe('mysql-author:42')
    expect(r.authors[0].isProvisional).toBe(false)
  })
})

describe('coverage & reconcile', () => {
  it('checkpoint düşük ID makaleyi atlar', () => {
    expect(wouldCheckpointSkipArticle(10000, 5000)).toBe(true)
    expect(wouldCheckpointSkipArticle(10000, 10001)).toBe(false)
  })

  it('ilişkisi olmayan makale missing', () => {
    const s = classifyArticleCoverage(
      { id: 5, authors_raw: 'Test Yazar' },
      undefined,
    )
    expect(s.status).toBe('missing')
  })

  it('kısmi ilişkili makale partial', () => {
    const s = classifyArticleCoverage(
      { id: 5, authors_raw: 'A Yazar, B Yazar' },
      { authorIds: new Set([1]), positions: new Map([[1, 1]]) },
    )
    expect(s.status).toBe('partial')
  })

  it('tam ilişkili makale complete', () => {
    const s = classifyArticleCoverage(
      { id: 5, authors_raw: 'A Yazar' },
      { authorIds: new Set([1]), positions: new Map([[1, 1]]) },
    )
    expect(s.status).toBe('complete')
  })

  it('reconcile raporu eksik ve kısmi sayar', () => {
    const report = buildReconcileReport([
      { articleId: 1, authorsRaw: 'A', expectedCount: 1, relationCount: 0, status: 'missing' },
      { articleId: 2, authorsRaw: 'A, B', expectedCount: 2, relationCount: 1, status: 'partial' },
      { articleId: 3, authorsRaw: 'C', expectedCount: 1, relationCount: 1, status: 'complete' },
    ])
    expect(report.missingRelations).toBe(1)
    expect(report.partialRelations).toBe(1)
    expect(report.toProcess).toBe(2)
  })

  it('processArticleAuthors eksik pozisyonu tamamlar', () => {
    const planned = planAuthorsForArticle(
      { id: 1, authors_raw: 'A Yazar, B Yazar' },
      buildYazarlarRegistry([]),
      false,
    ).authors
    const { toCreate } = processArticleAuthors(planned, {
      authorIds: new Set([99]),
      positions: new Map([[1, 99]]),
    })
    expect(toCreate.length).toBe(1)
    expect(toCreate[0].position).toBe(2)
  })

  it('pozisyon çakışmasında üzerine yazmaz', () => {
    const planned = planAuthorsForArticle(
      { id: 1, authors_raw: 'A Yazar' },
      buildYazarlarRegistry([]),
      false,
    ).authors
    const { toCreate, errors } = processArticleAuthors(planned, {
      authorIds: new Set([99]),
      positions: new Map([[1, 99]]),
    })
    expect(toCreate.length).toBe(0)
    expect(errors).toContain(AuthorEtlErrorType.POSITION_CONFLICT)
  })
})

describe('runAuthorsEtl', () => {
  it('dry-run yazma yapmaz', async () => {
    const articles = [{ id: 1, authors_raw: 'Test Yazar', status: 'published' }]
    const upsert = vi.fn()
    const sb = {
      from(table: string) {
        const chain = {
          select: () => chain,
          gt: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          upsert,
          then(resolve: (v: unknown) => void) {
            if (table === 'articles') resolve({ data: articles, error: null })
            else resolve({ data: [], error: null })
          },
        }
        return chain
      },
    }

    await runAuthorsEtl({
      sb: sb as never,
      registry: buildYazarlarRegistry([]),
      cli: { ...baseCli, dryRun: true, limit: 10 },
    })

    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('CLI', () => {
  it('missing-only ve reconcile flag', () => {
    const cli = parseAuthorEtlCliArgs(['--missing-only', '--reconcile', '--dry-run'])
    expect(cli.missingOnly).toBe(true)
    expect(cli.reconcile).toBe(true)
    expect(cli.dryRun).toBe(true)
  })
})

describe('comma classification', () => {
  it('çoklu yazar örneği', () => {
    const c = classifyCommaAuthorSample(1, 'Ahmet YILMAZ, Mehmet DEMİR')
    expect(c.classification).toBe('multi_author')
  })
})

describe('insufficient identity reporting', () => {
  it('boş yazar makale raporlanır', () => {
    const counters = createAuthorEtlCounters()
    const reg = buildYazarlarRegistry([])
    const r = planAuthorsForArticle({ id: 1, authors_raw: '   ', status: 'published' }, reg, false)
    expect(r.errorType).toBe(AuthorEtlErrorType.EMPTY_AUTHOR_TEXT)
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
              resolve({ data: articles.filter((a) => a.id > chain._gt), error: null })
            } else resolve({ data: [], error: null })
          },
        }
        return chain
      },
    }

    const result = await runAuthorsEtl({
      sb: sb as never,
      registry: buildYazarlarRegistry([]),
      cli: { ...baseCli, dryRun: true, startAfter: 150, limit: 10 },
    })

    expect(result.counters.articlesProcessed).toBe(1)
    expect(result.lastArticleId).toBe(200)
  })
})
