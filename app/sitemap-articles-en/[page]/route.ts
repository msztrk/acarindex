import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { articleSitemapUrlEntry, sitemapXmlResponse } from '@/lib/sitemap/xml'
import { publishedEnglishArticleWhere } from '@/lib/i18n/prisma-english-content'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const PAGE_SIZE = 5000

async function listEnglishArticlesForSitemapPage(page: number, perPage: number) {
  const rows = await prisma.article.findMany({
    where: publishedEnglishArticleWhere,
    orderBy: { id: 'asc' },
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      slug: true,
      slugTr: true,
      slugEn: true,
      legacyJournalSlug: true,
      legacyJournalSlugEn: true,
      hasEnContent: true,
      updatedAt: true,
    },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    slug_tr: r.slugTr ?? r.slug,
    slug_en: r.slugEn,
    legacy_journal_slug: r.legacyJournalSlug,
    legacy_journal_slug_en: r.legacyJournalSlugEn,
    has_en_content: r.hasEnContent,
    updated_at: r.updatedAt.toISOString(),
  }))
}

async function countEnglishArticles() {
  return prisma.article.count({ where: publishedEnglishArticleWhere })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page: rawPage } = await params
  const page = parseInt(rawPage.replace('.xml', ''), 10)
  if (isNaN(page) || page < 1) {
    return new Response('Not Found', { status: 404 })
  }

  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'
  const articles = await listEnglishArticlesForSitemapPage(page, PAGE_SIZE)

  if (articles.length === 0 && page > 1) {
    return new Response('Not Found', { status: 404 })
  }

  const urls = articles.map((a) => articleSitemapUrlEntry(base, a, 'en'))
  return sitemapXmlResponse(urls.join('\n'))
}

export { countEnglishArticles, PAGE_SIZE as EN_SITEMAP_PAGE_SIZE }
