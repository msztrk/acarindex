import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'

export async function logUserActivity(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
): Promise<void> {
  await writeAuditLog({
    actorId: userId,
    action,
    resource: 'user_panel',
    resourceId: userId,
    metadata,
    ipAddress,
  })
}

export async function getUserPanelSummary(userId: string) {
  const [savedArticles, readingLists, followedJournals, followedAuthors] = await Promise.all([
    prisma.savedArticle.count({ where: { userId } }),
    prisma.readingList.count({ where: { userId } }),
    prisma.followedJournal.count({ where: { userId } }),
    prisma.followedAuthor.count({ where: { userId } }),
  ])
  return {
    savedArticles,
    readingLists,
    followedJournals,
    followedAuthors,
  }
}

export async function getAdminUserPanelSummary(userId: string) {
  return getUserPanelSummary(userId)
}
