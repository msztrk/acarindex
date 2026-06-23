import { prisma } from '@/lib/db/prisma'
import { mapAuthor } from './serialize'

export async function getAuthorById(id: number) {
  const row = await prisma.author.findUnique({ where: { id: BigInt(id) } })
  return row ? mapAuthor(row) : null
}

export interface AuthorArticleRow {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  published_year: number | null
  published_at: string | null
  journal: { id: number; slug: string; title_tr: string | null } | null
  pdf: { legacy_pdf_path: string | null; file_status: string | null } | null
}

export async function listAuthorPublishedArticles(authorId: number): Promise<AuthorArticleRow[]> {
  const rows = await prisma.articleAuthor.findMany({
    where: {
      authorId: BigInt(authorId),
      article: { status: 'published' },
    },
    orderBy: { authorPosition: 'asc' },
    include: {
      article: {
        include: {
          journal: { select: { id: true, slug: true, titleTr: true } },
          pdfFile: { select: { legacyPdfPath: true, fileStatus: true } },
        },
      },
    },
  })
  return rows
    .filter((r) => r.article)
    .map((r) => {
      const a = r.article!
      return {
        id: Number(a.id),
        slug: a.slug,
        legacy_journal_slug: a.legacyJournalSlug,
        title_tr: a.titleTr,
        title_en: a.titleEn,
        published_year: a.publishedYear,
        published_at: a.publishedAt?.toISOString().slice(0, 10) ?? null,
        journal: a.journal
          ? {
              id: Number(a.journal.id),
              slug: a.journal.slug,
              title_tr: a.journal.titleTr,
            }
          : null,
        pdf: a.pdfFile
          ? {
              legacy_pdf_path: a.pdfFile.legacyPdfPath,
              file_status: a.pdfFile.fileStatus,
            }
          : null,
      }
    })
}

export async function suggestAuthors(q: string, limit = 5) {
  const rows = await prisma.author.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    take: limit,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    slug: r.slug,
  }))
}
