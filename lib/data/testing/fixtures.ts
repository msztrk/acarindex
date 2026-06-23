/**
 * Test ortamı için katalog yanıt sabitleri — production koduna enjekte edilmez.
 */
import type { CatalogQueryResult } from '@/lib/data/query'

export const FIXTURE_JOURNAL = {
  id: 9910001,
  slug: 'dev-fixture-j-1',
  title_tr: 'Geliştirme Dergisi 1',
  title_en: 'Development Journal 1',
  issn: '2999-0000',
  publisher: 'Dev Fixture Press',
  frequency: null,
  cover_path: null,
  hit_count: 0,
  category_id: 99001,
}

export const FIXTURE_ARTICLE_LONG_TITLE =
  'Çok uzun başlık örneği: Türkiye\'de sosyal bilimler alanında yapılan araştırmaların metodolojik yaklaşımları'

export const FIXTURE_DB_ERROR_MESSAGE =
  'Katalog veritabanına bağlanılamadı. Lütfen daha sonra tekrar deneyin.'

export function mockCatalogOk<T>(data: T): CatalogQueryResult<T> {
  return { status: 'ok', data }
}

export function mockCatalogEmpty(): CatalogQueryResult<never> {
  return { status: 'empty' }
}

export function mockCatalogDbError(): CatalogQueryResult<never> {
  return {
    status: 'error',
    kind: 'database',
    message: FIXTURE_DB_ERROR_MESSAGE,
  }
}

export function mockSearchResultsFull() {
  return {
    articleResults: {
      data: [
        {
          id: 9930001,
          slug: 'dev-fixture-article-1',
          legacy_journal_slug: 'dev-fixture-j-1',
          title_tr: FIXTURE_ARTICLE_LONG_TITLE,
          title_en: null,
          authors_raw: 'Yazar Bir, Yazar İkinci, Yazar Üçüncü',
          published_year: 2023,
          journal_title: FIXTURE_JOURNAL.title_tr,
          journal_slug: FIXTURE_JOURNAL.slug,
          journal_id: FIXTURE_JOURNAL.id,
          keywords_tr: 'fixture, test',
        },
      ],
      total: 1,
    },
    journalResults: { data: [FIXTURE_JOURNAL], total: 1 },
    authorResults: {
      data: [{ id: 1, slug: 'dev-fixture-author-1', name: 'Tek Yazar Fixture' }],
      total: 1,
    },
    perPage: 20,
  }
}

export function mockSearchResultsEmpty() {
  return {
    articleResults: { data: [], total: 0 },
    journalResults: { data: [], total: 0 },
    authorResults: { data: [], total: 0 },
    perPage: 20,
  }
}
