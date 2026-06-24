import { prisma } from '@/lib/db/prisma'
import { logUserActivity } from '@/lib/user-panel/summary'

export interface NotificationPrefsDto {
  followedJournalNewIssue: boolean
  followedAuthorNewArticle: boolean
  savedSearchAlert: boolean
  weeklyDigest: boolean
  productAnnouncements: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsDto = {
  followedJournalNewIssue: false,
  followedAuthorNewArticle: false,
  savedSearchAlert: false,
  weeklyDigest: false,
  productAnnouncements: false,
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPrefsDto> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } })
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFS }
  return {
    followedJournalNewIssue: row.followedJournalNewIssue,
    followedAuthorNewArticle: row.followedAuthorNewArticle,
    savedSearchAlert: row.savedSearchAlert,
    weeklyDigest: row.weeklyDigest,
    productAnnouncements: row.productAnnouncements,
  }
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPrefsDto>,
  ipAddress?: string,
): Promise<NotificationPrefsDto> {
  const data = {
    followedJournalNewIssue: prefs.followedJournalNewIssue,
    followedAuthorNewArticle: prefs.followedAuthorNewArticle,
    savedSearchAlert: prefs.savedSearchAlert,
    weeklyDigest: prefs.weeklyDigest,
    productAnnouncements: prefs.productAnnouncements,
  }
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  )
  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_NOTIFICATION_PREFS, ...filtered },
    update: filtered,
  })
  await logUserActivity(userId, 'user.notification_prefs.update', filtered, ipAddress)
  return {
    followedJournalNewIssue: row.followedJournalNewIssue,
    followedAuthorNewArticle: row.followedAuthorNewArticle,
    savedSearchAlert: row.savedSearchAlert,
    weeklyDigest: row.weeklyDigest,
    productAnnouncements: row.productAnnouncements,
  }
}
