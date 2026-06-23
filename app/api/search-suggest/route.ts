/**
 * GET /api/search-suggest — Prisma autocomplete.
 */
import { NextRequest, NextResponse } from 'next/server'
import { suggestArticles } from '@/lib/data/articles'
import { suggestAuthors } from '@/lib/data/authors'
import { prisma } from '@/lib/db/prisma'

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

  const [articleRows, journalRows, authorRows] = await Promise.all([
    suggestArticles(q, 3),
    prisma.journal.findMany({
      where: {
        status: 'published',
        OR: [
          { titleTr: { contains: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 2,
      orderBy: { hitCount: 'desc' },
      select: { id: true, slug: true, titleTr: true, titleEn: true },
    }),
    suggestAuthors(q, 2),
  ])

  const results: SuggestItem[] = []

  for (const a of articleRows) {
    results.push({
      type: 'article',
      id: a.id,
      label: a.title_tr ?? a.title_en ?? '',
      subtitle: a.published_year ? String(a.published_year) : undefined,
      href: `/${a.legacy_journal_slug}/${a.slug}-${a.id}`,
    })
  }

  for (const j of journalRows) {
    results.push({
      type: 'journal',
      id: Number(j.id),
      label: j.titleTr ?? j.titleEn ?? '',
      href: `/journals/${j.slug}-${j.id}`,
    })
  }

  for (const a of authorRows) {
    results.push({
      type: 'author',
      id: a.id,
      label: a.name,
      href: `/authors/${a.slug ?? a.id}-${a.id}`,
    })
  }

  return NextResponse.json({ results: results.slice(0, limit) })
}
