import { describe, expect, it } from 'vitest'
import { buildArticleUrl } from '@/lib/urls/article'
import { buildJournalUrl, parseJournalSegment } from '@/lib/urls/journal'
import { buildCitationData } from '@/components/seo/CitationMeta'
import {
  buildCanonicalUrl,
  buildSearchPaginationCanonical,
  estimateSitemapArticlePageCount,
  pathShouldNoindex,
  pdfUrlPolicy,
} from '@/lib/seo/url-contracts'
import { LEGACY_URL_REDIRECT_DRAFT } from '@/lib/seo/redirect-map'
import { SITEMAP_ARTICLES_PAGE_SIZE } from '@/lib/data/constants'

const BASE = 'https://www.acarindex.com'

describe('canonical URL üretimi', () => {
  it('makale URL kalıbı', () => {
    const path = buildArticleUrl('dev-fixture-j-1', 'Test Makale', 9930001)
    expect(path).toBe('/dev-fixture-j-1/test-makale-9930001')
    expect(buildCanonicalUrl(BASE, path)).toBe(
      'https://www.acarindex.com/dev-fixture-j-1/test-makale-9930001',
    )
  })

  it('dergi URL kalıbı', () => {
    const path = buildJournalUrl('Geliştirme Dergisi', 9910001)
    expect(path.startsWith('/journals/')).toBe(true)
    expect(parseJournalSegment(path.replace('/journals/', ''))).toEqual({
      journalSlug: expect.any(String),
      journalId: 9910001,
    })
  })
})

describe('citation meta null davranışı', () => {
  it('eksik DOI ve PDF alanlarını null bırakır', () => {
    const data = buildCitationData({
      title: 'Fixture',
      authors: ['A'],
      journalTitle: 'J',
      year: 2024,
      doi: null,
      pdfUrl: null,
      abstract: null,
    })
    expect(data.citation_doi).toBeNull()
    expect(data.citation_pdf_url).toBeNull()
    expect(data.citation_abstract).toBeNull()
    expect(data.citation_publication_date).toBe('2024')
  })

  it('http olmayan PDF URL citation_pdf_url olarak kullanılmaz', () => {
    const data = buildCitationData({
      title: 'T',
      authors: ['A'],
      journalTitle: 'J',
      pdfUrl: '/relative/path.pdf',
    })
    expect(data.citation_pdf_url).toBeNull()
  })
})

describe('pagination canonical', () => {
  it('sayfa 1 canonical query parametresi eklemez', () => {
    const url = buildSearchPaginationCanonical(BASE, { q: 'test' }, 1)
    expect(url).toBe(`${BASE}/search?q=test`)
  })

  it('sayfa 2+ page parametresi ekler', () => {
    const url = buildSearchPaginationCanonical(BASE, { q: 'test', type: 'article' }, 3)
    expect(url).toContain('page=3')
    expect(url).not.toContain('type=article')
  })
})

describe('noindex kuralları', () => {
  it('arama ve PDF viewer noindex', () => {
    expect(pathShouldNoindex('/search')).toBe(true)
    expect(pathShouldNoindex('/search?q=test')).toBe(true)
    expect(pathShouldNoindex('/pdfs/9930001')).toBe(true)
    expect(pathShouldNoindex('/journals/dev-fixture-j-1-9910001')).toBe(false)
  })
})

describe('sitemap parçalama', () => {
  it('kayıt sayısı olmadan sayfa sayısı hesaplar', () => {
    expect(estimateSitemapArticlePageCount(0)).toBe(1)
    expect(estimateSitemapArticlePageCount(SITEMAP_ARTICLES_PAGE_SIZE)).toBe(1)
    expect(estimateSitemapArticlePageCount(SITEMAP_ARTICLES_PAGE_SIZE + 1)).toBe(2)
  })
})

describe('PDF URL politikası', () => {
  it('viewer noindex ve missing sentinel tanımlı', () => {
    const policy = pdfUrlPolicy()
    expect(policy.viewerRobots).toContain('noindex')
    expect(policy.missingSentinel).toBe('pdf-bulunamadi')
  })
})

describe('legacy redirect taslağı', () => {
  it('eski URL kalıplarını listeler', () => {
    expect(LEGACY_URL_REDIRECT_DRAFT.length).toBeGreaterThan(0)
    const pdfRule = LEGACY_URL_REDIRECT_DRAFT.find((r) => r.legacyPattern.includes('pdfgoruntule'))
    expect(pdfRule?.canonicalPattern).toBe('/pdfs/{articleId}')
  })
})
