import { prisma } from '@/lib/db/prisma'
import { parsePagination, paginationMeta } from '@/lib/admin/pagination'
import { logUserActivity } from '@/lib/user-panel/summary'
import { isUserPanelRateLimited } from '@/lib/user-panel/rate-limit'

export async function listFollowedJournals(
  userId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.followedJournal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        journal: { select: { id: true, slug: true, titleTr: true, titleEn: true } },
      },
    }),
    prisma.followedJournal.count({ where: { userId } }),
  ])
  return {
    rows: rows.map((r) => ({
      journalId: Number(r.journalId),
      followedAt: r.createdAt.toISOString(),
      journal: r.journal
        ? {
            id: Number(r.journal.id),
            slug: r.journal.slug,
            titleTr: r.journal.titleTr,
            titleEn: r.journal.titleEn,
          }
        : null,
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function isJournalFollowed(userId: string, journalId: number): Promise<boolean> {
  const row = await prisma.followedJournal.findUnique({
    where: { userId_journalId: { userId, journalId: BigInt(journalId) } },
  })
  return Boolean(row)
}

export async function followJournal(
  userId: string,
  journalId: number,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (await isUserPanelRateLimited(userId)) {
    return { ok: false, error: 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.' }
  }
  const journal = await prisma.journal.findFirst({
    where: { id: BigInt(journalId), status: 'published' },
  })
  if (!journal) return { ok: false, error: 'Dergi bulunamadı.' }
  await prisma.followedJournal.upsert({
    where: { userId_journalId: { userId, journalId: BigInt(journalId) } },
    create: { userId, journalId: BigInt(journalId) },
    update: {},
  })
  await logUserActivity(userId, 'user.follow.journal', { journalId }, ipAddress)
  return { ok: true }
}

export async function unfollowJournal(
  userId: string,
  journalId: number,
  ipAddress?: string,
): Promise<{ ok: boolean }> {
  await prisma.followedJournal.delete({
    where: { userId_journalId: { userId, journalId: BigInt(journalId) } },
  }).catch(() => undefined)
  await logUserActivity(userId, 'user.unfollow.journal', { journalId }, ipAddress)
  return { ok: true }
}

export async function listFollowedAuthors(
  userId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.followedAuthor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        author: { select: { id: true, slug: true, name: true, isProvisional: true } },
      },
    }),
    prisma.followedAuthor.count({ where: { userId } }),
  ])
  return {
    rows: rows.map((r) => ({
      authorId: Number(r.authorId),
      followedAt: r.createdAt.toISOString(),
      author: r.author
        ? {
            id: Number(r.author.id),
            slug: r.author.slug,
            name: r.author.name,
            isProvisional: r.author.isProvisional,
          }
        : null,
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function isAuthorFollowed(userId: string, authorId: number): Promise<boolean> {
  const row = await prisma.followedAuthor.findUnique({
    where: { userId_authorId: { userId, authorId: BigInt(authorId) } },
  })
  return Boolean(row)
}

export async function followAuthor(
  userId: string,
  authorId: number,
  ipAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (await isUserPanelRateLimited(userId)) {
    return { ok: false, error: 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.' }
  }
  const author = await prisma.author.findUnique({ where: { id: BigInt(authorId) } })
  if (!author) return { ok: false, error: 'Yazar bulunamadı.' }
  if (author.isProvisional) {
    return { ok: false, error: 'Provisional yazarlar için takip henüz desteklenmiyor.' }
  }
  await prisma.followedAuthor.upsert({
    where: { userId_authorId: { userId, authorId: BigInt(authorId) } },
    create: { userId, authorId: BigInt(authorId) },
    update: {},
  })
  await logUserActivity(userId, 'user.follow.author', { authorId }, ipAddress)
  return { ok: true }
}

export async function unfollowAuthor(
  userId: string,
  authorId: number,
  ipAddress?: string,
): Promise<{ ok: boolean }> {
  await prisma.followedAuthor.delete({
    where: { userId_authorId: { userId, authorId: BigInt(authorId) } },
  }).catch(() => undefined)
  await logUserActivity(userId, 'user.unfollow.author', { authorId }, ipAddress)
  return { ok: true }
}
