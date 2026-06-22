import { describe, expect, it } from 'vitest'
import { dedupeAndSortAuthorArticles, compareAuthorArticles } from '../lib/authors/articles'
import { normalizeOrcidValue, buildOrcidUrl } from '../lib/authors/orcid'
import {
  buildAuthorMetadataDescription,
  normalizeAuthorDisplayName,
} from '../lib/authors/display'
import { buildAuthorUrl, parseAuthorSlugAndId } from '../lib/urls/author'

describe('parseAuthorSlugAndId', () => {
  it('slug-id segmentini parse eder', () => {
    expect(parseAuthorSlugAndId('ahmet-guven-15')).toEqual({
      authorId: 15,
      slugPart: 'ahmet-guven',
    })
  })

  it('yalnızca sayısal ID kabul eder', () => {
    expect(parseAuthorSlugAndId('15')).toEqual({ authorId: 15 })
  })

  it('geçersiz ID reddeder', () => {
    expect(parseAuthorSlugAndId('yazar-abc')).toBeNull()
    expect(parseAuthorSlugAndId('yazar-0')).toBeNull()
    expect(parseAuthorSlugAndId('yazar--1')).toBeNull()
    expect(parseAuthorSlugAndId('')).toBeNull()
  })
})

describe('buildAuthorUrl', () => {
  it('canonical yazar URL üretir', () => {
    expect(buildAuthorUrl({ id: 15, slug: 'ahmet-guven' })).toBe('/authors/ahmet-guven-15')
    expect(buildAuthorUrl({ id: 9, slug: null })).toBe('/authors/9')
  })
})

describe('dedupeAndSortAuthorArticles', () => {
  it('yayın yılına göre yeniden eskiye sıralar', () => {
    const sorted = dedupeAndSortAuthorArticles([
      { id: 1, published_year: 2010, published_at: null },
      { id: 2, published_year: 2020, published_at: null },
    ])
    expect(sorted.map((a) => a.id)).toEqual([2, 1])
  })

  it('aynı yılda sayısal ID ile stabil sıra verir', () => {
    expect(
      compareAuthorArticles(
        { id: 10, published_year: 2020, published_at: null },
        { id: 2, published_year: 2020, published_at: null },
      ),
    ).toBeLessThan(0)
  })

  it('mükerrer makaleleri çıkarır', () => {
    const sorted = dedupeAndSortAuthorArticles([
      { id: 5, published_year: 2020, published_at: null },
      { id: 5, published_year: 2020, published_at: null },
    ])
    expect(sorted).toHaveLength(1)
  })

  it('eksik yıl kayıtlarını sona bırakır', () => {
    const sorted = dedupeAndSortAuthorArticles([
      { id: 1, published_year: null, published_at: null },
      { id: 2, published_year: 2020, published_at: null },
    ])
    expect(sorted.map((a) => a.id)).toEqual([2, 1])
  })
})

describe('normalizeAuthorDisplayName', () => {
  it('HTML entity ve fazla boşlukları temizler', () => {
    expect(normalizeAuthorDisplayName('  Ahmet &amp; Mehmet  ')).toBe('Ahmet & Mehmet')
  })
})

describe('normalizeOrcidValue', () => {
  it('geçerli ORCID kabul eder', () => {
    expect(normalizeOrcidValue('0000-0002-1825-0097')).toBe('0000-0002-1825-0097')
    expect(buildOrcidUrl('0000-0002-1825-0097')).toBe('https://orcid.org/0000-0002-1825-0097')
  })

  it('geçersiz ORCID formatını reddeder', () => {
    expect(normalizeOrcidValue('not-an-orcid')).toBeNull()
    expect(normalizeOrcidValue('1234-5678')).toBeNull()
  })
})

describe('buildAuthorMetadataDescription', () => {
  it('makale sayısını description içine ekler', () => {
    expect(buildAuthorMetadataDescription('Ahmet GÜVEN', 3)).toContain('3 akademik makale')
  })

  it('makalesiz yazarda genel açıklama üretir', () => {
    expect(buildAuthorMetadataDescription('Ahmet GÜVEN', 0)).toContain('akademik makaleleri')
  })
})
