/**
 * GET /api/search-suggest?q={query}&limit={n}
 *
 * Autocomplete önerileri:
 * - Makale başlıkları (ilk 3)
 * - Dergi adları (ilk 2)
 * - Yazar isimleri (ilk 2)
 *
 * Faz-3'te Meilisearch'e bağlanacak; şu an Postgres ILIKE.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface SuggestItem {
  type: 'article' | 'journal' | 'author'
  id: number
  label: string
  subtitle?: string
  href: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '7', 10), 20)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const sb = await createClient()

  // Paralel sorgu
  const [articleRes, journalRes, authorRes] = await Promise.all([
    sb
      .from('articles')
      .select('id, slug, legacy_journal_slug, title_tr, title_en, published_year')
      .eq('status', 'published')
      .or(`title_tr.ilike.%${q}%,title_en.ilike.%${q}%`)
      .order('hit_count', { ascending: false })
      .limit(3),

    sb
      .from('journals')
      .select('id, slug, title_tr, title_en')
      .eq('status', 'published')
      .or(`title_tr.ilike.%${q}%,title_en.ilike.%${q}%`)
      .order('hit_count', { ascending: false })
      .limit(2),

    sb
      .from('authors')
      .select('id, slug, name')
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(2),
  ])

  const results: SuggestItem[] = []

  for (const a of (articleRes.data ?? []) as {
    id: number; slug: string; legacy_journal_slug: string
    title_tr: string | null; title_en: string | null; published_year: number | null
  }[]) {
    results.push({
      type: 'article',
      id: a.id,
      label: a.title_tr ?? a.title_en ?? '',
      subtitle: a.published_year ? String(a.published_year) : undefined,
      href: `/${a.legacy_journal_slug}/${a.slug}-${a.id}`,
    })
  }

  for (const j of (journalRes.data ?? []) as {
    id: number; slug: string; title_tr: string | null; title_en: string | null
  }[]) {
    results.push({
      type: 'journal',
      id: j.id,
      label: j.title_tr ?? j.title_en ?? '',
      href: `/journals/${j.slug}-${j.id}`,
    })
  }

  for (const a of (authorRes.data ?? []) as { id: number; slug: string | null; name: string }[]) {
    results.push({
      type: 'author',
      id: a.id,
      label: a.name,
      href: `/authors/${a.slug ?? a.id}-${a.id}`,
    })
  }

  return NextResponse.json({ results: results.slice(0, limit) })
}
