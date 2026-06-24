import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password'
import { revokeOtherSessions } from '@/lib/auth/session'

export async function changeUserPassword(input: {
  userId: string
  currentPassword: string
  newPassword: string
  sessionId?: string
  revokeOtherSessions?: boolean
  ipAddress?: string
}): Promise<{ ok: boolean; error?: string; revokedSessions?: number }> {
  const policyError = validatePasswordStrength(input.newPassword)
  if (policyError) return { ok: false, error: policyError }

  const credential = await prisma.userCredential.findUnique({
    where: { userId: input.userId },
    include: { user: true },
  })
  if (!credential) return { ok: false, error: 'Kimlik bilgisi bulunamadı.' }
  if (credential.user.status !== 'active') {
    return { ok: false, error: 'Hesap pasif.' }
  }

  const valid = await verifyPassword(input.currentPassword, credential.passwordHash)
  if (!valid) return { ok: false, error: 'Mevcut parola hatalı.' }

  const sameAsOld = await verifyPassword(input.newPassword, credential.passwordHash)
  if (sameAsOld) return { ok: false, error: 'Yeni parola mevcut paroladan farklı olmalıdır.' }

  const hash = await hashPassword(input.newPassword)
  await prisma.userCredential.update({
    where: { userId: input.userId },
    data: { passwordHash: hash },
  })

  let revokedSessions = 0
  if (input.revokeOtherSessions) {
    revokedSessions = await revokeOtherSessions(input.userId, input.sessionId)
  }

  await writeAuditLog({
    actorId: input.userId,
    action: 'auth.password.change',
    resource: 'user',
    resourceId: input.userId,
    metadata: { revokedSessions },
    ipAddress: input.ipAddress,
  })

  return { ok: true, revokedSessions }
}
