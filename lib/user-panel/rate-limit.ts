import { prisma } from '@/lib/db/prisma'
import { USER_PANEL_WRITE_LIMIT, USER_PANEL_WRITE_WINDOW_MS } from '@/lib/user-panel/config'

export async function isUserPanelRateLimited(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - USER_PANEL_WRITE_WINDOW_MS)
  const count = await prisma.auditLog.count({
    where: {
      actorId: userId,
      action: { startsWith: 'user.' },
      createdAt: { gte: since },
    },
  })
  return count >= USER_PANEL_WRITE_LIMIT
}
