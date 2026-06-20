/**
 * Arama mantığı — Faz-2: Postgres ILIKE + tsvector
 * Faz-3'te Meilisearch ile değiştirilecek; arayüz aynı kalır.
 */

import { createClient } from '@/lib/supabase/server'

export type SearchType = 'article' | 'journal' | 'author'
export type SearchArea = 'all' | 'title' | 'author' | 'keywords' | 'abstract'

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
}

export interface JournalResult {
  id: number
  slug: string
  title_tr: string | null
  title_en: string | null
  issn: string | null
  publisher: string | null
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

// ─── Legacy prefix desteği: "author:xxx" → area + q ayrıştır ────────────────
export function parsePrefixQuery(raw: string): { q: string; area: SearchArea } {
  const prefixMap: Record<string, SearchArea> = {
    'author': 'author',
    'title': 'title',
    'keyword': 'keywords',
    'abstract': 'abstract',
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

/**
 * Arama alanlarına göre ILIKE OR koşulu üretir.
 * Faz-3'te Meilisearch adapter değiştiğinde bu fonksiyon silinir.
 */
export function buildSearchCondition(area: SearchArea, q: string): string {
  const esc = q.replace(/'/g, "''")  // minimal SQL injection guard
  switch (area) {
    case 'title':
      return `title_tr.ilike.%${esc}%,title_en.ilike.%${esc}%`
    case 'author':
      return `authors_raw.ilike.%${esc}%`
    case 'keywords':
      return `keywords_tr.ilike.%${esc}%,keywords_en.ilike.%${esc}%`
    case 'abstract':
      return `abstract_tr.ilike.%${esc}%,abstract_en.ilike.%${esc}%`
    case 'all':
    default:
      // Tüm alanlar — pg_trgm GIN indexleri aktifken performanslı çalışır
      return [
        `title_tr.ilike.%${esc}%`,
        `title_en.ilike.%${esc}%`,
        `authors_raw.ilike.%${esc}%`,
        `keywords_tr.ilike.%${esc}%`,
        `keywords_en.ilike.%${esc}%`,
        `abstract_tr.ilike.%${esc}%`,
        `abstract_en.ilike.%${esc}%`,
      ].join(',')
  }
}

// ─── Makale arama ────────────────────────────────────────────────────────────
export async function searchArticles(params: SearchParams): Promise<{ data: ArticleResult[]; total: number }> {
  const sb = await createClient()
  const { q, area, language, journalId, yearFrom, yearTo, page, perPage } = params
  const offset = (page - 1) * perPage

  let query = sb
    .from('articles')
    .select(`
      id, slug, legacy_journal_slug,
      title_tr, title_en, authors_raw, keywords_tr, published_year,
      journal:journals!journal_id ( id, slug, title_tr )
    `, { count: 'exact' })
    .eq('status', 'published')

  if (q) {
    query = query.or(buildSearchCondition(area, q))
  }

  if (language) query = query.eq('language', language)
  if (journalId) query = query.eq('journal_id', journalId)
  if (yearFrom) query = query.gte('published_year', yearFrom)
  if (yearTo) query = query.lte('published_year', yearTo)

  query = query.order('published_year', { ascending: false }).range(offset, offset + perPage - 1)

  const { data, count } = await query

  const results: ArticleResult[] = (data ?? []).map((row: Record<string, unknown>) => {
    const j = row.journal as { id: number; slug: string; title_tr: string | null } | null
    return {
      id: row.id as number,
      slug: row.slug as string,
      legacy_journal_slug: row.legacy_journal_slug as string,
      title_tr: row.title_tr as string | null,
      title_en: row.title_en as string | null,
      authors_raw: row.authors_raw as string | null,
      keywords_tr: row.keywords_tr as string | null,
      published_year: row.published_year as number | null,
      journal_title: j?.title_tr ?? null,
      journal_slug: j?.slug ?? null,
      journal_id: j?.id ?? null,
    }
  })

  return { data: results, total: count ?? 0 }
}

// ─── Dergi arama ─────────────────────────────────────────────────────────────
export async function searchJournals(q: string, page: number, perPage: number) {
  const sb = await createClient()
  const offset = (page - 1) * perPage

  const { data, count } = await sb
    .from('journals')
    .select('id, slug, title_tr, title_en, issn, publisher', { count: 'exact' })
    .eq('status', 'published')
    .or(`title_tr.ilike.%${q}%,title_en.ilike.%${q}%,issn.ilike.%${q}%`)
    .order('title_tr', { ascending: true })
    .range(offset, offset + perPage - 1)

  return { data: (data ?? []) as JournalResult[], total: count ?? 0 }
}

// ─── Yazar arama ─────────────────────────────────────────────────────────────
export async function searchAuthors(q: string, page: number, perPage: number) {
  const sb = await createClient()
  const offset = (page - 1) * perPage

  const { data, count } = await sb
    .from('authors')
    .select('id, slug, name', { count: 'exact' })
    .ilike('name', `%${q}%`)
    .order('name', { ascending: true })
    .range(offset, offset + perPage - 1)

  return { data: (data ?? []) as AuthorResult[], total: count ?? 0 }
}
