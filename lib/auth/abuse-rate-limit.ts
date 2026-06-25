import { prisma } from '@/lib/db/prisma'

export type AbuseEventType =
  | 'register'
  | 'verify_resend'
  | 'forgot_password'
  | 'token_verify'
  | 'register_honeypot'

export async function recordAbuseEvent(
  eventType: AbuseEventType,
  key: string,
  ipAddress?: string,
): Promise<void> {
  await prisma.abuseEvent.create({
    data: {
      eventType,
      key: key.toLowerCase().trim(),
      ipAddress: ipAddress ?? null,
    },
  })
}

export async function isAbuseRateLimited(
  eventType: AbuseEventType,
  key: string,
  max: number,
  windowMs: number,
  ipAddress?: string,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs)
  const normalized = key.toLowerCase().trim()

  const byKey = await prisma.abuseEvent.count({
    where: { eventType, key: normalized, createdAt: { gte: since } },
  })
  if (byKey >= max) return true

  if (ipAddress) {
    const byIp = await prisma.abuseEvent.count({
      where: { eventType, ipAddress, createdAt: { gte: since } },
    })
    if (byIp >= max * 2) return true
  }

  return false
}
