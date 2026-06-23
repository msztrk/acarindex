import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIST_PAGE_SIZE,
  JOURNALS_PER_PAGE,
  SEARCH_PER_PAGE,
  SITEMAP_ARTICLES_PAGE_SIZE,
  ISSUE_ARTICLES_MAX,
} from '@/lib/data/constants'
import { CATALOG_QUERY_RISKS } from '@/lib/data/n1-risks'
import {
  mockCatalogDbError,
  mockCatalogOk,
  mockSearchResultsEmpty,
  mockSearchResultsFull,
} from '@/lib/data/testing/fixtures'

describe('data layer pagination constants', () => {
  it('liste sorguları için sayfa boyutları tanımlı', () => {
    expect(JOURNALS_PER_PAGE).toBeGreaterThan(0)
    expect(SEARCH_PER_PAGE).toBeGreaterThan(0)
    expect(DEFAULT_LIST_PAGE_SIZE).toBeGreaterThan(0)
    expect(SITEMAP_ARTICLES_PAGE_SIZE).toBeGreaterThan(0)
    expect(ISSUE_ARTICLES_MAX).toBeGreaterThan(0)
  })
})

describe('catalog query result contracts', () => {
  it('ok sonuç data taşır', () => {
    const r = mockCatalogOk({ total: 5 })
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.data.total).toBe(5)
  })

  it('db hata mesajı teknik secret içermez', () => {
    const r = mockCatalogDbError()
    expect(r.status).toBe('error')
    if (r.status === 'error') {
      expect(r.message).not.toMatch(/postgresql:\/\//i)
      expect(r.message).not.toMatch(/password/i)
    }
  })

  it('mock arama sonuçları pagination alanı içerir', () => {
    const full = mockSearchResultsFull()
    expect(full.perPage).toBe(SEARCH_PER_PAGE)
    expect(full.articleResults.total).toBeGreaterThan(0)

    const empty = mockSearchResultsEmpty()
    expect(empty.articleResults.total).toBe(0)
    expect(empty.journalResults.data).toHaveLength(0)
  })
})

describe('N+1 risk envanteri', () => {
  it('bilinen risk alanlarını listeler', () => {
    expect(CATALOG_QUERY_RISKS.length).toBeGreaterThan(0)
    const issueRisk = CATALOG_QUERY_RISKS.find((r) => r.id === 'issue-articles-list')
    expect(issueRisk?.status).toBe('mitigated')
    expect(issueRisk?.mitigation).toMatch(/ISSUE_ARTICLES_MAX/i)
  })
})
