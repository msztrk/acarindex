import { prisma } from '@/lib/db/prisma'
import {
  generateToken,
  hashToken,
  VERIFY_TOKEN_TTL_MS,
  VERIFY_RESEND_MAX,
  VERIFY_RESEND_WINDOW_MS,
  TOKEN_ATTEMPT_MAX,
  TOKEN_ATTEMPT_WINDOW_MS,
} from '@/lib/auth/config'
import { writeAuditLog } from '@/lib/auth/audit'
import { isAbuseRateLimited, recordAbuseEvent } from '@/lib/auth/abuse-rate-limit'
import { isEmailVerificationEnabled } from '@/lib/features/auth-lifecycle'
import { createEmailService } from '@/lib/email/templates'

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const raw = generateToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS)

  await prisma.verificationToken.deleteMany({
    where: { userId, type: 'email_verify', usedAt: null },
  })

  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash,
      type: 'email_verify',
      expiresAt,
    },
  })

  return raw
}

export async function sendVerificationEmailForUser(
  userId: string,
  email: string,
): Promise<{ ok: boolean }> {
  if (!isEmailVerificationEnabled()) return { ok: true }
  const raw = await createEmailVerificationToken(userId)
  const verifyUrl = `${siteBaseUrl()}/verify-email?token=${encodeURIComponent(raw)}`
  const emailService = createEmailService()
  return emailService.sendVerificationEmail({
    to: email,
    verifyUrl,
    expiresHours: Math.round(VERIFY_TOKEN_TTL_MS / (60 * 60 * 1000)),
  })
}

export async function verifyEmailToken(
  rawToken: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; error?: string }> {
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
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash } })
  if (!row || row.type !== 'email_verify') {
    return { ok: false, error: 'Bağlantı geçersiz veya süresi dolmuş.' }
  }
  if (row.usedAt) return { ok: false, error: 'Bu bağlantı zaten kullanıldı.' }
  if (row.expiresAt < new Date()) {
    return { ok: false, error: 'Bağlantı süresi doldu. Yeni doğrulama e-postası isteyin.' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ])

  await writeAuditLog({
    actorId: row.userId,
    action: 'auth.email.verify',
    resource: 'user',
    resourceId: row.userId,
    ipAddress: meta?.ipAddress,
  })

  return { ok: true }
}

/** Enumeration-safe resend — her zaman aynı genel mesaj döner. */
export async function requestVerificationResend(
  email: string,
  meta?: { ipAddress?: string },
): Promise<{ ok: boolean; message: string }> {
  const message =
    'E-posta adresiniz kayıtlıysa doğrulama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.'

  if (!isEmailVerificationEnabled()) {
    return { ok: true, message }
  }

  const normalized = email.toLowerCase().trim()
  if (!normalized) return { ok: true, message }

  if (
    await isAbuseRateLimited(
      'verify_resend',
      normalized,
      VERIFY_RESEND_MAX,
      VERIFY_RESEND_WINDOW_MS,
      meta?.ipAddress,
    )
  ) {
    return { ok: true, message }
  }

  await recordAbuseEvent('verify_resend', normalized, meta?.ipAddress)

  const user = await prisma.user.findUnique({ where: { email: normalized } })
  if (!user || user.emailVerified) {
    return { ok: true, message }
  }

  await sendVerificationEmailForUser(user.id, user.email)
  return { ok: true, message }
}
