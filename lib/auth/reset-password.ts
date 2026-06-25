import { prisma } from '@/lib/db/prisma'
import {
  generateToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
  FORGOT_PASSWORD_MAX,
  FORGOT_PASSWORD_WINDOW_MS,
  TOKEN_ATTEMPT_MAX,
  TOKEN_ATTEMPT_WINDOW_MS,
} from '@/lib/auth/config'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { writeAuditLog } from '@/lib/auth/audit'
import { revokeAllSessionsForUser } from '@/lib/auth/session-mgmt'
import { isAbuseRateLimited, recordAbuseEvent } from '@/lib/auth/abuse-rate-limit'
import { isPasswordResetEnabled } from '@/lib/features/auth-lifecycle'
import { createEmailService } from '@/lib/email/templates'

const GENERIC_FORGOT_MESSAGE =
  'E-posta adresiniz kayıtlıysa parola sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.'

import { buildAuthActionUrl } from '@/lib/email/public-url'

export async function requestPasswordReset(
  email: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; message: string }> {
  if (!isPasswordResetEnabled()) {
    return { ok: true, message: GENERIC_FORGOT_MESSAGE }
  }

  const normalized = email.toLowerCase().trim()
  if (!normalized) return { ok: true, message: GENERIC_FORGOT_MESSAGE }

  if (
    await isAbuseRateLimited(
      'forgot_password',
      normalized,
      FORGOT_PASSWORD_MAX,
      FORGOT_PASSWORD_WINDOW_MS,
      meta?.ipAddress,
    )
  ) {
    return { ok: true, message: GENERIC_FORGOT_MESSAGE }
  }

  await recordAbuseEvent('forgot_password', normalized, meta?.ipAddress)

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { credential: true },
  })

  if (!user?.credential || user.status !== 'active') {
    return { ok: true, message: GENERIC_FORGOT_MESSAGE }
  }

  const raw = generateToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  const resetUrl = buildAuthActionUrl('/reset-password', { token: raw })
  const emailService = createEmailService()
  await emailService.sendPasswordResetEmail({
    to: user.email,
    resetUrl,
    expiresMinutes: Math.round(RESET_TOKEN_TTL_MS / 60000),
  })

  await writeAuditLog({
    actorId: user.id,
    action: 'auth.password.reset.request',
    resource: 'user',
    resourceId: user.id,
    ipAddress: meta?.ipAddress,
  })

  return { ok: true, message: GENERIC_FORGOT_MESSAGE }
}

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; error?: string }> {
  const policy = validatePasswordStrength(newPassword)
  if (policy) return { ok: false, error: policy }

  if (!rawToken.trim()) return { ok: false, error: 'Geçersiz bağlantı.' }

  if (
    await isAbuseRateLimited(
      'token_verify',
      hashToken(rawToken),
      TOKEN_ATTEMPT_MAX,
      TOKEN_ATTEMPT_WINDOW_MS,
      meta?.ipAddress,
    )
  ) {
    return { ok: false, error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' }
  }

  await recordAbuseEvent('token_verify', hashToken(rawToken), meta?.ipAddress)

  const tokenHash = hashToken(rawToken)
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!row || row.usedAt) {
    return { ok: false, error: 'Bağlantı geçersiz veya süresi dolmuş.' }
  }
  if (row.expiresAt < new Date()) {
    return { ok: false, error: 'Bağlantı süresi doldu. Yeni sıfırlama talebi oluşturun.' }
  }
  if (row.user.status !== 'active') {
    return { ok: false, error: 'Hesap aktif değil.' }
  }

  const hash = await hashPassword(newPassword)

  await prisma.$transaction([
    prisma.userCredential.update({
      where: { userId: row.userId },
      data: { passwordHash: hash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ])

  await revokeAllSessionsForUser(row.userId)

  await writeAuditLog({
    actorId: row.userId,
    action: 'auth.password.reset.complete',
    resource: 'user',
    resourceId: row.userId,
    ipAddress: meta?.ipAddress,
  })

  const emailService = createEmailService()
  await emailService.sendSecurityNotification({
    to: row.user.email,
    subject: 'Parola değiştirildi',
    body: 'Hesabınızın parolası sıfırlandı. Bu işlemi siz yapmadıysanız hemen destek ile iletişime geçin.',
  })

  return { ok: true }
}
