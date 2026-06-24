import { prisma } from '@/lib/db/prisma'
import { parsePagination, paginationMeta } from '@/lib/admin/pagination'
import { READING_LIST_NAME_MAX } from '@/lib/user-panel/config'
import { getReadingListForUser } from '@/lib/user-panel/ownership'
import { logUserActivity } from '@/lib/user-panel/summary'
import { isUserPanelRateLimited } from '@/lib/user-panel/rate-limit'

function validateListName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Liste adı gerekli.'
  if (trimmed.length > READING_LIST_NAME_MAX) return `Liste adı en fazla ${READING_LIST_NAME_MAX} karakter olabilir.`
  return null
}

export async function listReadingLists(userId: string) {
  const rows = await prisma.readingList.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { items: { select: { id: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    itemCount: r.items.length,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function getReadingListDetail(userId: string, listId: string) {
  const list = await prisma.readingList.findFirst({
    where: { id: listId, userId },
    include: {
      items: {
        orderBy: { position: 'asc' },
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
      },
    },
  })
  if (!list) return null
  return {
    id: list.id,
    name: list.name,
    items: list.items.map((item) => ({
      id: item.id,
      position: item.position,
      articleId: Number(item.articleId),
      article: item.article
        ? {
            id: Number(item.article.id),
            slug: item.article.slug,
            legacyJournalSlug: item.article.legacyJournalSlug,
            titleTr: item.article.titleTr,
            titleEn: item.article.titleEn,
            publishedYear: item.article.publishedYear,
            journalSlug: item.article.journal?.slug,
            journalTitleTr: item.article.journal?.titleTr,
          }
        : null,
    })),
  }
}

export async function createReadingList(
  userId: string,
  name: string,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string; listId?: string }> {
  const err = validateListName(name)
  if (err) return { ok: false, error: err }
  if (await isUserPanelRateLimited(userId)) {
    return { ok: false, error: 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.' }
  }
  const list = await prisma.readingList.create({
    data: { userId, name: name.trim() },
  })
  await logUserActivity(userId, 'user.reading_list.create', { listId: list.id }, ipAddress)
  return { ok: true, listId: list.id }
}

export async function updateReadingList(
  userId: string,
  listId: string,
  name: string,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  const err = validateListName(name)
  if (err) return { ok: false, error: err }
  const list = await getReadingListForUser(userId, listId)
  if (!list) return { ok: false, error: 'Liste bulunamadı.' }
  await prisma.readingList.update({
    where: { id: listId },
    data: { name: name.trim() },
  })
  await logUserActivity(userId, 'user.reading_list.update', { listId }, ipAddress)
  return { ok: true }
}

export async function deleteReadingList(
  userId: string,
  listId: string,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  const list = await getReadingListForUser(userId, listId)
  if (!list) return { ok: false, error: 'Liste bulunamadı.' }
  await prisma.readingList.delete({ where: { id: listId } })
  await logUserActivity(userId, 'user.reading_list.delete', { listId }, ipAddress)
  return { ok: true }
}

export async function addArticleToList(
  userId: string,
  listId: string,
  articleId: number,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  const list = await getReadingListForUser(userId, listId)
  if (!list) return { ok: false, error: 'Liste bulunamadı.' }
  const article = await prisma.article.findFirst({
    where: { id: BigInt(articleId), status: 'published' },
  })
  if (!article) return { ok: false, error: 'Makale bulunamadı.' }

  const maxPos = await prisma.readingListItem.aggregate({
    where: { listId },
    _max: { position: true },
  })
  const position = (maxPos._max.position ?? -1) + 1

  await prisma.readingListItem.upsert({
    where: {
      listId_articleId: { listId, articleId: BigInt(articleId) },
    },
    create: { listId, articleId: BigInt(articleId), position },
    update: {},
  })
  await prisma.readingList.update({ where: { id: listId }, data: { updatedAt: new Date() } })
  await logUserActivity(userId, 'user.reading_list.item.add', { listId, articleId }, ipAddress)
  return { ok: true }
}

export async function removeArticleFromList(
  userId: string,
  listId: string,
  articleId: number,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  const list = await getReadingListForUser(userId, listId)
  if (!list) return { ok: false, error: 'Liste bulunamadı.' }
  await prisma.readingListItem.delete({
    where: { listId_articleId: { listId, articleId: BigInt(articleId) } },
  }).catch(() => undefined)
  await prisma.readingList.update({ where: { id: listId }, data: { updatedAt: new Date() } })
  await logUserActivity(userId, 'user.reading_list.item.remove', { listId, articleId }, ipAddress)
  return { ok: true }
}

export async function reorderListItems(
  userId: string,
  listId: string,
  itemIds: string[],
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  const list = await getReadingListForUser(userId, listId)
  if (!list) return { ok: false, error: 'Liste bulunamadı.' }
  const existing = await prisma.readingListItem.findMany({
    where: { listId },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((i) => i.id))
  if (itemIds.length !== existingIds.size || itemIds.some((id) => !existingIds.has(id))) {
    return { ok: false, error: 'Geçersiz sıralama.' }
  }
  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.readingListItem.update({
        where: { id },
        data: { position: index },
      }),
    ),
  )
  await prisma.readingList.update({ where: { id: listId }, data: { updatedAt: new Date() } })
  await logUserActivity(userId, 'user.reading_list.reorder', { listId }, ipAddress)
  return { ok: true }
}
