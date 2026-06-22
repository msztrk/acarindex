/**
 * Platform istatistikleri — Prisma / raw view.
 */
import { prisma } from '@/lib/db/prisma'

export interface PlatformStatsRow {
  journal_count: number
  article_count: number
  pdf_count: number
  total_hits: number
  author_count: number
  institution_count: number
  refreshed_at: Date
}

export async function getPlatformStats(): Promise<PlatformStatsRow | null> {
  const rows = await prisma.$queryRaw<PlatformStatsRow[]>`
    SELECT journal_count, article_count, pdf_count, total_hits, author_count, institution_count, refreshed_at
    FROM platform_stats
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function countAccessiblePdfs(): Promise<number> {
  return prisma.pdfFile.count({
    where: { fileStatus: { not: 'missing' } },
  })
}

export async function countPublishedJournals(): Promise<number> {
  return prisma.journal.count({ where: { status: 'published' } })
}

export async function countPublishedArticles(): Promise<number> {
  return prisma.article.count({ where: { status: 'published' } })
}

export async function countAuthors(): Promise<number> {
  return prisma.author.count()
}
