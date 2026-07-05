import * as journalData from '@/lib/data/journals'
import * as catalogData from '@/lib/data/catalog'
import { JOURNALS_PER_PAGE } from '@/lib/data/constants'
import { runCatalogQuery } from '@/lib/data/query'

export async function loadJournalsPageData(options: {
  categoryId?: number
  q?: string
  page: number
}) {
  return runCatalogQuery(async () => {
    const [{ journals, total }, categories] = await Promise.all([
      journalData.listJournalsPaginated({
        categoryId: options.categoryId,
        q: options.q,
        page: options.page,
        perPage: JOURNALS_PER_PAGE,
      }),
      catalogData.listActiveCategories(),
    ])
    return { journals, total, categories, perPage: JOURNALS_PER_PAGE }
  })
}

export async function loadSearchPageData(options: {
  q: string
  type: 'article' | 'journal' | 'author'
  area: string
  page: number
  language?: 'tr' | 'en'
  yearFrom?: number
  yearTo?: number
  journalId?: number
  boostCategoryIds?: number[]
  personalize?: boolean
}) {
  const { searchArticles, searchJournals, searchAuthors } = await import('@/lib/search/search')
  const { SEARCH_PER_PAGE } = await import('@/lib/data/constants')

  if (!options.q) {
    return {
      status: 'ok' as const,
      data: {
        articleResults: { data: [], total: 0, interestTotal: 0 },
        journalResults: { data: [], total: 0, interestTotal: 0 },
        authorResults: { data: [], total: 0 },
        perPage: SEARCH_PER_PAGE,
        personalized: false,
      },
    }
  }

  const personalize = options.personalize !== false
  const boostCategoryIds = personalize ? options.boostCategoryIds ?? [] : []

  return runCatalogQuery(async () => {
    let articleResults = {
      data: [] as Awaited<ReturnType<typeof searchArticles>>['data'],
      total: 0,
      interestTotal: 0,
    }
    let journalResults = {
      data: [] as Awaited<ReturnType<typeof searchJournals>>['data'],
      total: 0,
      interestTotal: 0,
    }
    let authorResults = { data: [] as Awaited<ReturnType<typeof searchAuthors>>['data'], total: 0 }

    if (options.type === 'article') {
      articleResults = await searchArticles({
        q: options.q,
        type: 'article',
        area: options.area as 'all' | 'title' | 'author' | 'keywords',
        language: options.language,
        journalId: options.journalId,
        yearFrom: options.yearFrom,
        yearTo: options.yearTo,
        page: options.page,
        perPage: SEARCH_PER_PAGE,
        boostCategoryIds,
        personalize,
      })
    } else if (options.type === 'journal') {
      journalResults = await searchJournals(options.q, options.page, SEARCH_PER_PAGE, {
        boostCategoryIds,
        personalize,
      })
    } else {
      authorResults = await searchAuthors(options.q, options.page, SEARCH_PER_PAGE)
    }

    return {
      articleResults,
      journalResults,
      authorResults,
      perPage: SEARCH_PER_PAGE,
      personalized: boostCategoryIds.length > 0 && personalize,
    }
  })
}
