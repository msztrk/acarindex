import { prisma } from '@/lib/db/prisma'
import { destroySession, revokeOtherSessions } from '@/lib/auth/session'

export interface SessionListItem {
  id: string
  isCurrent: boolean
  createdAt: string
  lastUsedAt: string | null
  deviceHint: string
}

export function parseDeviceHint(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Bilinmeyen cihaz'
  const ua = userAgent.toLowerCase()
  let browser = 'Tarayıcı'
  if (ua.includes('edg/')) browser = 'Edge'
  else if (ua.includes('chrome/')) browser = 'Chrome'
  else if (ua.includes('firefox/')) browser = 'Firefox'
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari'

  let os = 'cihaz'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac os')) os = 'macOS'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  else if (ua.includes('linux')) os = 'Linux'

  return `${browser} · ${os}`
}

export async function touchSessionLastUsed(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined)
}

export async function listUserSessions(
  userId: string,
  currentSessionId?: string,
): Promise<SessionListItem[]> {
  const rows = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((s) => ({
    id: s.id,
    isCurrent: s.id === currentSessionId,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
    deviceHint: parseDeviceHint(s.userAgent),
  }))
}

export async function revokeUserSession(
  userId: string,
  sessionId: string,
  currentSessionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
  })
  if (!session) return { ok: false, error: 'Oturum bulunamadı.' }
  if (session.id === currentSessionId) {
    return { ok: false, error: 'Mevcut oturumu bu ekrandan kapatmak için çıkış yapın.' }
  }
  await destroySession(session.id)
  return { ok: true }
}

export async function revokeAllSessionsForUser(
  userId: string,
  keepSessionId?: string,
): Promise<number> {
  return revokeOtherSessions(userId, keepSessionId)
}

export async function countActiveSessions(userId: string): Promise<number> {
  return prisma.session.count({
    where: { userId, expiresAt: { gt: new Date() } },
  })
}
