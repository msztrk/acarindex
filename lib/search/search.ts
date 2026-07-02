/**
 * Arama mantığı — Prisma / standart PostgreSQL.
 */
import {
  searchArticlesPrisma,
  searchAuthorsPrisma,
  searchJournalsPrisma,
} from '@/lib/data/search'
import { normalizeSearchTerm } from '@/lib/search/normalize'

export type SearchType = 'article' | 'journal' | 'author'

export type SearchArea = 'all' | 'title' | 'author' | 'keywords'

export interface SearchParams {
  q: string
  type: SearchType
  area: SearchArea
  language?: 'tr' | 'en'
  journalId?: number
  yearFrom?: number
  yearTo?: number
  page: number
  perPage: number
  boostCategoryIds?: number[]
  personalize?: boolean
}

export interface ArticleResult {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  authors_raw: string | null
  keywords_tr: string | null
  published_year: number | null
  journal_title: string | null
  journal_slug: string | null
  journal_id: number | null
  category_label: string | null
  matches_interest: boolean
}

export interface JournalResult {
  id: number
  slug: string
  title_tr: string | null
  title_en: string | null
  issn: string | null
  publisher: string | null
  category_label: string | null
  matches_interest: boolean
}

export interface AuthorResult {
  id: number
  slug: string | null
  name: string
}

export interface SearchResults {
  articles: ArticleResult[]
  journals: JournalResult[]
  authors: AuthorResult[]
  total: number
}

export function parsePrefixQuery(raw: string): { q: string; area: SearchArea } {
  const prefixMap: Record<string, SearchArea> = {
    author: 'author',
    title: 'title',
    keyword: 'keywords',
  }
  const colonIdx = raw.indexOf(':')
  if (colonIdx > 0) {
    const prefix = raw.slice(0, colonIdx).toLowerCase().trim()
    const value = raw.slice(colonIdx + 1).trim()
    if (prefixMap[prefix] && value) {
      return { q: value, area: prefixMap[prefix] }
    }
  }
  return { q: raw, area: 'all' }
}

/** PostgREST uyumluluk testleri için ILIKE koşul üretici (Prisma’da kullanılmaz). */
export function buildSearchCondition(area: SearchArea, q: string): string {
  const esc = normalizeSearchTerm(q).replace(/'/g, "''").replace(/[*?\\]/g, '\\$&')
  switch (area) {
    case 'title':
      return `title_tr.ilike.*${esc}*,title_en.ilike.*${esc}*`
    case 'author':
      return `authors_raw.ilike.*${esc}*`
    case 'keywords':
      return `keywords_tr.ilike.*${esc}*,keywords_en.ilike.*${esc}*`
    case 'all':
    default:
      return [
        `title_tr.ilike.*${esc}*`,
        `title_en.ilike.*${esc}*`,
        `authors_raw.ilike.*${esc}*`,
        `keywords_tr.ilike.*${esc}*`,
        `keywords_en.ilike.*${esc}*`,
      ].join(',')
  }
}


export async function searchArticles(params: SearchParams) {
  return searchArticlesPrisma(params)
}

export async function searchJournals(
  q: string,
  page: number,
  perPage: number,
  options?: { boostCategoryIds?: number[]; personalize?: boolean },
) {
  return searchJournalsPrisma(q, page, perPage, options)
}

export async function searchAuthors(q: string, page: number, perPage: number) {
  return searchAuthorsPrisma(q, page, perPage)
}
