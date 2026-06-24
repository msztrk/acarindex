import { prisma } from '@/lib/db/prisma'
import { parsePagination, paginationMeta } from '@/lib/admin/pagination'
import { logUserActivity } from '@/lib/user-panel/summary'
import { isUserPanelRateLimited } from '@/lib/user-panel/rate-limit'

export async function listSavedArticles(
  userId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.savedArticle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        article: {
          select: {
            id: true,
            slug: true,
            legacyJournalSlug: true,
            titleTr: true,
            titleEn: true,
            publishedYear: true,
            journal: { select: { slug: true, titleTr: true } },
          },
        },
      },
    }),
    prisma.savedArticle.count({ where: { userId } }),
  ])
  return {
    rows: rows.map((r) => ({
      articleId: Number(r.articleId),
      savedAt: r.createdAt.toISOString(),
      article: r.article
        ? {
            id: Number(r.article.id),
            slug: r.article.slug,
            legacyJournalSlug: r.article.legacyJournalSlug,
            titleTr: r.article.titleTr,
            titleEn: r.article.titleEn,
            publishedYear: r.article.publishedYear,
            journalSlug: r.article.journal?.slug,
            journalTitleTr: r.article.journal?.titleTr,
          }
        : null,
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function isArticleSaved(userId: string, articleId: number): Promise<boolean> {
  const row = await prisma.savedArticle.findUnique({
    where: { userId_articleId: { userId, articleId: BigInt(articleId) } },
  })
  return Boolean(row)
}

export async function saveArticle(
  userId: string,
  articleId: number,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (await isUserPanelRateLimited(userId)) {
    return { ok: false, error: 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.' }
  }
  const article = await prisma.article.findFirst({
    where: { id: BigInt(articleId), status: 'published' },
  })
  if (!article) return { ok: false, error: 'Makale bulunamadı.' }

  await prisma.savedArticle.upsert({
    where: { userId_articleId: { userId, articleId: BigInt(articleId) } },
    create: { userId, articleId: BigInt(articleId) },
    update: {},
  })
  await logUserActivity(userId, 'user.saved_article.add', { articleId }, ipAddress)
  return { ok: true }
}

export async function unsaveArticle(
  userId: string,
  articleId: number,
  ipAddress?: string,
): Promise<{ ok: boolean }> {
  await prisma.savedArticle.delete({
    where: { userId_articleId: { userId, articleId: BigInt(articleId) } },
  }).catch(() => undefined)
  await logUserActivity(userId, 'user.saved_article.remove', { articleId }, ipAddress)
  return { ok: true }
}
