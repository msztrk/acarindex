import { prisma } from '@/lib/db/prisma'
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from '@/lib/auth/config'

export async function isLoginRateLimited(email: string, ipAddress?: string | null): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS)
  const normalized = email.toLowerCase().trim()

  const emailFails = await prisma.loginAttempt.count({
    where: {
      email: normalized,
      success: false,
      createdAt: { gte: since },
    },
  })
  if (emailFails >= LOGIN_MAX_ATTEMPTS) return true

  if (ipAddress) {
    const ipFails = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: since },
      },
    })
    if (ipFails >= LOGIN_MAX_ATTEMPTS * 2) return true
  }

  return false
}

export async function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress?: string | null,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email: email.toLowerCase().trim(),
      success,
      ipAddress: ipAddress ?? null,
    },
  })
}
