import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  mockCatalogDbError,
  mockCatalogOk,
  mockSearchResultsEmpty,
  mockSearchResultsFull,
  FIXTURE_DB_ERROR_MESSAGE,
} from '@/lib/data/testing/fixtures'

describe('mock catalog fixtures', () => {
  it('dolu arama sonucu', () => {
    const data = mockSearchResultsFull()
    expect(data.articleResults.total).toBe(1)
    expect(data.journalResults.data[0].slug).toContain('dev-fixture')
  })

  it('boş arama sonucu', () => {
    const data = mockSearchResultsEmpty()
    expect(data.articleResults.total).toBe(0)
    expect(data.authorResults.total).toBe(0)
  })

  it('bağlantı hatası mock', () => {
    const err = mockCatalogDbError()
    expect(err.status).toBe('error')
    if (err.status === 'error') {
      expect(err.message).toBe(FIXTURE_DB_ERROR_MESSAGE)
    }
  })

  it('bulunamayan dergi senaryosu — boş liste', () => {
    const ok = mockCatalogOk({ journals: [], total: 0, categories: [], perPage: 60 })
    expect(ok.status).toBe('ok')
    if (ok.status === 'ok') {
      expect(ok.data.journals).toHaveLength(0)
      expect(ok.data.total).toBe(0)
    }
  })
})

describe('page loader mock pattern', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('loadSearchPageData boş sorguda DB çağırmaz', async () => {
    const { loadSearchPageData } = await import('@/lib/data/page-loaders')
    const result = await loadSearchPageData({
      q: '',
      type: 'article',
      area: 'all',
      page: 1,
    })
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.data.articleResults.total).toBe(0)
    }
  })
})
