import { prisma } from '@/lib/db/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { writeAuditLog } from '@/lib/auth/audit'
import {
  REGISTER_MAX_PER_IP,
  REGISTER_WINDOW_MS,
} from '@/lib/auth/config'
import { isAbuseRateLimited, recordAbuseEvent } from '@/lib/auth/abuse-rate-limit'
import { getCaptchaVerifier, isCaptchaRequired } from '@/lib/auth/captcha'
import {
  isEmailVerificationEnabled,
  isPublicRegistrationEnabled,
} from '@/lib/features/auth-lifecycle'
import { recordLegalAcceptances } from '@/lib/auth/legal'
import { sendVerificationEmailForUser } from '@/lib/auth/verify-email'
import {
  buildCsrfCookie,
  buildSessionCookie,
  createCsrfToken,
  createSession,
} from '@/lib/auth/session'

export async function registerPublicUser(input: {
  email: string
  password: string
  name?: string
  acceptedDocumentIds: string[]
  marketingOptIn?: boolean
  honeypot?: string
  captchaToken?: string
  ipAddress?: string
  userAgent?: string
}): Promise<{
  ok: boolean
  error?: string
  cookies?: Array<{ name: string; value: string; options: Record<string, unknown> }>
  requiresVerification?: boolean
}> {
  if (!isPublicRegistrationEnabled()) {
    return { ok: false, error: 'Üyelik yakında açılacak.' }
  }

  if (input.honeypot?.trim()) {
    await recordAbuseEvent('register_honeypot', input.email, input.ipAddress)
    return { ok: false, error: 'Kayıt tamamlanamadı.' }
  }

  if (isCaptchaRequired()) {
    const captcha = getCaptchaVerifier()
    const valid = await captcha.verify(input.captchaToken, input.ipAddress)
    if (!valid) return { ok: false, error: 'Güvenlik doğrulaması başarısız.' }
  }

  const normalized = input.email.toLowerCase().trim()
  if (!normalized) return { ok: false, error: 'E-posta gerekli.' }

  if (
    await isAbuseRateLimited(
      'register',
      normalized,
      REGISTER_MAX_PER_IP,
      REGISTER_WINDOW_MS,
      input.ipAddress,
    )
  ) {
    return { ok: false, error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' }
  }

  await recordAbuseEvent('register', normalized, input.ipAddress)

  const strength = validatePasswordStrength(input.password)
  if (strength) return { ok: false, error: strength }

  const existing = await prisma.user.findUnique({ where: { email: normalized } })
  if (existing) return { ok: false, error: 'Bu e-posta zaten kayıtlı.' }

  const hash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      email: normalized,
      name: input.name?.trim() || null,
      status: 'active',
      emailVerified: isEmailVerificationEnabled() ? null : new Date(),
      credential: { create: { passwordHash: hash } },
      roles: { create: [{ roleId: 'USER' }] },
      notificationPrefs: { create: {} },
    },
  })

  const legal = await recordLegalAcceptances(user.id, {
    acceptedDocumentIds: input.acceptedDocumentIds,
    marketingOptIn: input.marketingOptIn ?? false,
  })
  if (!legal.ok) {
    await prisma.user.delete({ where: { id: user.id } })
    return { ok: false, error: legal.error }
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'auth.register',
    resource: 'user',
    resourceId: user.id,
    ipAddress: input.ipAddress,
  })

  let requiresVerification = false
  if (isEmailVerificationEnabled()) {
    requiresVerification = true
    await sendVerificationEmailForUser(user.id, user.email)
  }

  const token = await createSession(user.id, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  const csrf = createCsrfToken()

  return {
    ok: true,
    requiresVerification,
    cookies: [buildSessionCookie(token), buildCsrfCookie(csrf)],
  }
}
