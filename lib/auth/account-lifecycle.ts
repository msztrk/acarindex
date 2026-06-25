import { prisma } from '@/lib/db/prisma'
import { DELETION_GRACE_DAYS } from '@/lib/auth/config'
import { verifyPassword } from '@/lib/auth/password'
import { writeAuditLog } from '@/lib/auth/audit'
import { revokeAllSessionsForUser } from '@/lib/auth/session-mgmt'
import { createEmailService, buildDeletionRequestEmail } from '@/lib/email/templates'

export async function deactivateOwnAccount(
  userId: string,
  password: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; error?: string }> {
  const credential = await prisma.userCredential.findUnique({ where: { userId } })
  if (!credential) return { ok: false, error: 'Kimlik bilgisi bulunamadı.' }

  const valid = await verifyPassword(password, credential.passwordHash)
  if (!valid) return { ok: false, error: 'Parola hatalı.' }

  await prisma.user.update({
    where: { id: userId },
    data: { status: 'deactivated' },
  })

  await revokeAllSessionsForUser(userId)

  await writeAuditLog({
    actorId: userId,
    action: 'auth.account.deactivate',
    resource: 'user',
    resourceId: userId,
    ipAddress: meta?.ipAddress,
  })

  return { ok: true }
}

export async function requestAccountDeletion(
  userId: string,
  password: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; error?: string; scheduledFor?: string }> {
  const credential = await prisma.userCredential.findUnique({
    where: { userId },
    include: { user: true },
  })
  if (!credential) return { ok: false, error: 'Kimlik bilgisi bulunamadı.' }

  const valid = await verifyPassword(password, credential.passwordHash)
  if (!valid) return { ok: false, error: 'Parola hatalı.' }

  const scheduledFor = new Date()
  scheduledFor.setDate(scheduledFor.getDate() + DELETION_GRACE_DAYS)

  await prisma.accountDeletionRequest.updateMany({
    where: { userId, status: { in: ['pending', 'scheduled'] } },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })

  await prisma.accountDeletionRequest.create({
    data: {
      userId,
      status: 'scheduled',
      scheduledFor,
    },
  })

  await revokeAllSessionsForUser(userId)

  await writeAuditLog({
    actorId: userId,
    action: 'auth.account.deletion.request',
    resource: 'user',
    resourceId: userId,
    metadata: { scheduledFor: scheduledFor.toISOString() },
    ipAddress: meta?.ipAddress,
  })

  const emailService = createEmailService()
  const body = buildDeletionRequestEmail(scheduledFor.toLocaleDateString('tr-TR'))
  await emailService.sendSecurityNotification({
    to: credential.user.email,
    subject: 'Hesap silme talebi',
    body: body.text,
  })

  return { ok: true, scheduledFor: scheduledFor.toISOString() }
}

export async function cancelAccountDeletion(
  userId: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; error?: string }> {
  const active = await prisma.accountDeletionRequest.findFirst({
    where: { userId, status: { in: ['pending', 'scheduled'] } },
    orderBy: { requestedAt: 'desc' },
  })
  if (!active) return { ok: false, error: 'Aktif silme talebi bulunamadı.' }

  await prisma.accountDeletionRequest.update({
    where: { id: active.id },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })

  await writeAuditLog({
    actorId: userId,
    action: 'auth.account.deletion.cancel',
    resource: 'user',
    resourceId: userId,
    ipAddress: meta?.ipAddress,
  })

  return { ok: true }
}

export async function getDeletionRequestStatus(userId: string) {
  const row = await prisma.accountDeletionRequest.findFirst({
    where: { userId, status: { in: ['pending', 'scheduled'] } },
    orderBy: { requestedAt: 'desc' },
  })
  if (!row) return null
  return {
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    scheduledFor: row.scheduledFor.toISOString(),
  }
}

export async function adminVerifyUserEmail(
  userId: string,
  actorId: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; error?: string }> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  })

  await writeAuditLog({
    actorId,
    action: 'auth.email.verify.admin',
    resource: 'user',
    resourceId: userId,
    ipAddress: meta?.ipAddress,
  })

  return { ok: true }
}
