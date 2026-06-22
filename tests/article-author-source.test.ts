/**
 * Makale yazar kaynağı kolon seçimi testleri.
 */
import { describe, it, expect } from 'vitest'
import {
  selectArticleAuthorSource,
  mapMakaleAuthorFields,
  ArticleAuthorSourceError,
  ARTICLE_AUTHOR_SOURCE_COLUMNS,
  resolveAuthorRegistryMode,
} from '../lib/etl/article-author-source'
import { loadAuthorRegistry, assertAuthorRegistryReadyForWrite, planAuthorsForArticle } from '../lib/etl/run-authors-etl'
import { buildYazarlarRegistry, parseAuthorList, collectAuthorParseIssues } from '../lib/etl/author-utils'
import { articleAuthorSourceKey } from '../lib/etl/author-source-key'

describe('article author source column', () => {
  it('Yazarlar birincil kaynak olarak seçilir', () => {
    const sel = selectArticleAuthorSource({
      Yazarlar: 'Ahmet Kaya, Mehmet Yılmaz, Fatma Demir',
      YazarlarKAYNAKCA: 'Kaya, A., Yılmaz, M.',
    })
    expect(sel.sourceColumn).toBe(ARTICLE_AUTHOR_SOURCE_COLUMNS.display)
    expect(sel.authorsRaw).toBe('Ahmet Kaya, Mehmet Yılmaz, Fatma Demir')
    expect(sel.authorsCitation).toBe('Kaya, A., Yılmaz, M.')
  })

  it('Yazarlar boşsa YazarlarKAYNAKCA’ya sessizce düşmez', () => {
    const sel = selectArticleAuthorSource({
      Yazarlar: '',
      YazarlarKAYNAKCA: 'Kaya, A.',
    })
    expect(sel.sourceColumn).toBe(ARTICLE_AUTHOR_SOURCE_COLUMNS.display)
    expect(sel.authorsRaw).toBeNull()
    expect(sel.authorsCitation).toBe('Kaya, A.')
  })

  it('kolon yoksa açık hata verir', () => {
    expect(() => selectArticleAuthorSource({})).toThrow(ArticleAuthorSourceError)
    expect(() =>
      selectArticleAuthorSource({ YazarlarKAYNAKCA: 'x' }),
    ).toThrow(/Yazarlar kolonu/)
  })

  it('mapMakaleAuthorFields ETL 03 eşlemesi', () => {
    const m = mapMakaleAuthorFields({
      Yazarlar: '  Ali Veli ',
      YazarlarKAYNAKCA: 'Veli, A.',
    })
    expect(m.authors_raw).toBe('Ali Veli')
    expect(m.authors_citation).toBe('Veli, A.')
    expect(m.sourceColumn).toBe('Yazarlar')
  })
})

describe('comma-separated author parsing', () => {
  it('üç yazar virgülle ayrılır', () => {
    expect(parseAuthorList('Ahmet Yılmaz, Mehmet Demir, Ayşe Kaya')).toEqual([
      'Ahmet Yılmaz',
      'Mehmet Demir',
      'Ayşe Kaya',
    ])
  })

  it('Türkçe karakterler korunur', () => {
    expect(parseAuthorList('İbrahim Çelik, Özgür Şahin')).toEqual(['İbrahim Çelik', 'Özgür Şahin'])
  })

  it('Kiril/Arapça/Yunanca korunur', () => {
    expect(parseAuthorList('Александр Иванов, محمد أحمد, Γεώργιος Παπαδόπουλος')).toHaveLength(3)
  })

  it('boş segment raporlanır', () => {
    const issues = collectAuthorParseIssues('Ali Veli,, Mehmet')
    expect(issues.some((i) => i.class === 'empty_author_segment')).toBe(true)
    expect(parseAuthorList('Ali Veli,, Mehmet')).toEqual(['Ali Veli', 'Mehmet'])
  })

  it('Soyad, Ad belirsizliği raporlanır', () => {
    const issues = collectAuthorParseIssues('YILMAZ, Ahmet Ali')
    expect(issues.some((i) => i.class === 'ambiguous_comma_format')).toBe(true)
  })

  it('yazar pozisyonları 1’den başlar', () => {
    const reg = buildYazarlarRegistry([])
    const r = planAuthorsForArticle({ id: 123, authors_raw: 'A Yazar, B Yazar' }, reg, false)
    expect(r.authors.map((a) => a.position)).toEqual([1, 2])
    expect(r.authors.every((a) => a.isProvisional)).toBe(true)
    expect(r.authors[0]?.sourceKey).toBe(articleAuthorSourceKey(123, 1))
  })
})

describe('AUTHOR_REGISTRY_MODE', () => {
  it('varsayılan required', () => {
    expect(resolveAuthorRegistryMode({})).toBe('required')
  })

  it('provisional-only modu', () => {
    expect(resolveAuthorRegistryMode({ AUTHOR_REGISTRY_MODE: 'provisional-only' })).toBe(
      'provisional-only',
    )
  })

  it('yazarlar tablosu yokken required yazma engellenir', () => {
    expect(() =>
      assertAuthorRegistryReadyForWrite({
        registry: buildYazarlarRegistry([]),
        mode: 'required',
        yazarlarTablePresent: false,
        yazarlarRowCount: 0,
      }),
    ).toThrow(/provisional-only/)
  })

  it('provisional-only modda registry boş kalır', async () => {
    const pool = {
      async execute(sql: string) {
        if (sql.includes('information_schema')) return [[{ c: 0 }]]
        return [[{ id: 1, yazar: 'Test' }]]
      },
    }
    const load = await loadAuthorRegistry(pool, 'provisional-only')
    expect(load.mode).toBe('provisional-only')
    expect(load.yazarlarRowCount).toBe(0)
    expect(load.registry.resolve('Test')).toBeNull()
  })
})
