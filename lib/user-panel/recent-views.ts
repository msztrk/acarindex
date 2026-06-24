import { prisma } from '@/lib/db/prisma'
import { RECENT_VIEWS_MAX, isRecentEntityType, type RecentEntityType } from '@/lib/user-panel/config'

export async function recordRecentView(
  userId: string,
  entityType: RecentEntityType,
  entityId: number,
): Promise<void> {
  if (!isRecentEntityType(entityType)) return

  const exists = await entityExists(entityType, entityId)
  if (!exists) return

  await prisma.recentView.upsert({
    where: {
      userId_entityType_entityId: {
        userId,
        entityType,
        entityId: BigInt(entityId),
      },
    },
    create: {
      userId,
      entityType,
      entityId: BigInt(entityId),
      viewedAt: new Date(),
    },
    update: { viewedAt: new Date() },
  })

  const overflow = await prisma.recentView.findMany({
    where: { userId },
    orderBy: { viewedAt: 'desc' },
    skip: RECENT_VIEWS_MAX,
    select: { id: true },
  })
  if (overflow.length > 0) {
    await prisma.recentView.deleteMany({
      where: { id: { in: overflow.map((r) => r.id) } },
    })
  }
}

async function entityExists(entityType: RecentEntityType, entityId: number): Promise<boolean> {
  const id = BigInt(entityId)
  if (entityType === 'article') {
    const a = await prisma.article.findFirst({ where: { id, status: 'published' } })
    return Boolean(a)
  }
  if (entityType === 'journal') {
    const j = await prisma.journal.findFirst({ where: { id, status: 'published' } })
    return Boolean(j)
  }
  const au = await prisma.author.findUnique({ where: { id } })
  return Boolean(au)
}

export async function listRecentViews(userId: string) {
  const rows = await prisma.recentView.findMany({
    where: { userId },
    orderBy: { viewedAt: 'desc' },
    take: RECENT_VIEWS_MAX,
  })

  const articleIds = rows.filter((r) => r.entityType === 'article').map((r) => r.entityId)
  const journalIds = rows.filter((r) => r.entityType === 'journal').map((r) => r.entityId)
  const authorIds = rows.filter((r) => r.entityType === 'author').map((r) => r.entityId)

  const [articles, journals, authors] = await Promise.all([
    articleIds.length
      ? prisma.article.findMany({
          where: { id: { in: articleIds } },
          select: {
            id: true,
            slug: true,
            legacyJournalSlug: true,
            titleTr: true,
            titleEn: true,
          },
        })
      : [],
    journalIds.length
      ? prisma.journal.findMany({
          where: { id: { in: journalIds } },
          select: { id: true, slug: true, titleTr: true, titleEn: true },
        })
      : [],
    authorIds.length
      ? prisma.author.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, slug: true, name: true },
        })
      : [],
  ])

  const articleMap = new Map(articles.map((a) => [Number(a.id), a]))
  const journalMap = new Map(journals.map((j) => [Number(j.id), j]))
  const authorMap = new Map(authors.map((a) => [Number(a.id), a]))

  return rows.map((r) => {
    const entityId = Number(r.entityId)
    let label = `${r.entityType}:${entityId}`
    let href: string | null = null
    if (r.entityType === 'article') {
      const a = articleMap.get(entityId)
      if (a) {
        label = a.titleTr ?? a.titleEn ?? label
        href = `/${a.legacyJournalSlug}/${a.slug}-${entityId}`
      }
    } else if (r.entityType === 'journal') {
      const j = journalMap.get(entityId)
      if (j) {
        label = j.titleTr ?? j.titleEn ?? label
        href = `/journals/${j.slug}-${entityId}`
      }
    } else if (r.entityType === 'author') {
      const a = authorMap.get(entityId)
      if (a?.slug) {
        label = a.name
        href = `/authors/${a.slug}-${entityId}`
      }
    }
    return {
      entityType: r.entityType,
      entityId,
      viewedAt: r.viewedAt.toISOString(),
      label,
      href,
    }
  })
}

export async function clearRecentViews(userId: string): Promise<void> {
  await prisma.recentView.deleteMany({ where: { userId } })
}
