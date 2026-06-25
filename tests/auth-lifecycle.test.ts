import { describe, expect, it, beforeAll } from 'vitest'
import { hashToken, generateToken } from '@/lib/auth/config'
import {
  buildVerificationEmail,
  buildPasswordResetEmail,
  buildPasswordChangedEmail,
} from '@/lib/email/templates'
import {
  isPublicRegistrationEnabled,
  isEmailVerificationEnabled,
  isPasswordResetEnabled,
} from '@/lib/features/auth-lifecycle'

describe('auth lifecycle flags default', () => {
  it('public registration off by default', () => {
    expect(isPublicRegistrationEnabled()).toBe(false)
  })

  it('email verification off by default', () => {
    expect(isEmailVerificationEnabled()).toBe(false)
  })

  it('password reset off by default', () => {
    expect(isPasswordResetEnabled()).toBe(false)
  })
})

describe('token hashing', () => {
  it('hashes tokens without exposing raw value', () => {
    const raw = generateToken()
    const hash = hashToken(raw)
    expect(hash).not.toContain(raw)
    expect(hash.length).toBe(64)
  })
})

describe('email templates', () => {
  it('verification template includes link and expiry', () => {
    const body = buildVerificationEmail({
      to: 'a@example.com',
      verifyUrl: 'http://127.0.0.1:3000/verify-email?token=abc',
      expiresHours: 24,
    })
    expect(body.text).toContain('AcarIndex')
    expect(body.text).toContain('verify-email')
    expect(body.text).toContain('24')
  })

  it('reset template warns on unsolicited use', () => {
    const body = buildPasswordResetEmail({
      to: 'a@example.com',
      resetUrl: 'http://127.0.0.1:3000/reset-password?token=abc',
      expiresMinutes: 60,
    })
    expect(body.text).toContain('sıfırlama')
    expect(body.text).toContain('60')
  })

  it('password changed notification', () => {
    const body = buildPasswordChangedEmail()
    expect(body.text).toContain('değiştirildi')
  })
})

describe('device hint', () => {
  it('parses user agent without IP', async () => {
    const { parseDeviceHint } = await import('@/lib/auth/session-mgmt')
    expect(parseDeviceHint('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0')).toContain('Chrome')
    expect(parseDeviceHint(null)).toBe('Bilinmeyen cihaz')
  })
})

describe('console email provider', () => {
  it('never returns secret material in result', async () => {
    const { ConsoleEmailProvider } = await import('@/lib/email/console-provider')
    const provider = new ConsoleEmailProvider()
    const r = await provider.send({
      to: 'a@example.com',
      subject: 'test',
      text: 'body',
      html: 'body',
    })
    expect(r.ok).toBe(true)
    expect(r.error).toBeUndefined()
  })
})

const runLifecycleIntegration = process.env.AUTH_LIFECYCLE_INTEGRATION === '1'
const describeLifecycle = runLifecycleIntegration ? describe.sequential : describe.sequential.skip

describeLifecycle('auth lifecycle integration', () => {
  beforeAll(() => {
    process.env.APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'http://127.0.0.1:3001'
  })

  it('forgot password enumeration-safe message', async () => {
    process.env.ENABLE_PASSWORD_RESET = '1'
    const { requestPasswordReset } = await import('@/lib/auth/reset-password')
    const a = await requestPasswordReset('nobody@invalid.test')
    const b = await requestPasswordReset('another@invalid.test')
    expect(a.message).toBe(b.message)
    delete process.env.ENABLE_PASSWORD_RESET
  })

  it('verification token single use', async () => {
    const { prisma } = await import('@/lib/db/prisma')
    const { createEmailVerificationToken, verifyEmailToken } = await import('@/lib/auth/verify-email')
    const { ensureUserPanelTestUsers, resolveTestPassword } = await import('@/scripts/db/seed-user-panel-users')

    const password = resolveTestPassword()
    const { userAId } = await ensureUserPanelTestUsers(password)
    await prisma.user.update({
      where: { id: userAId },
      data: { emailVerified: null },
    })

    const raw = await createEmailVerificationToken(userAId)
    const first = await verifyEmailToken(raw)
    expect(first.ok).toBe(true)

    const second = await verifyEmailToken(raw)
    expect(second.ok).toBe(false)

    const user = await prisma.user.findUnique({ where: { id: userAId } })
    expect(user?.emailVerified).not.toBeNull()
  }, 60000)

  it('reset token revokes sessions', async () => {
    const { prisma } = await import('@/lib/db/prisma')
    const { requestPasswordReset, resetPasswordWithToken } = await import('@/lib/auth/reset-password')
    const { createSession } = await import('@/lib/auth/session')
    const { ensureUserPanelTestUsers, resolveTestPassword, USER_PANEL_TEST_EMAIL_A } =
      await import('@/scripts/db/seed-user-panel-users')

    process.env.ENABLE_PASSWORD_RESET = '1'
    const password = resolveTestPassword()
    const { userAId } = await ensureUserPanelTestUsers(password)
    await createSession(userAId)
    const before = await prisma.session.count({ where: { userId: userAId } })
    expect(before).toBeGreaterThan(0)

    const req = await requestPasswordReset(USER_PANEL_TEST_EMAIL_A)
    expect(req.ok).toBe(true)

    // Console provider — token yalnızca DB'den test için üret
    const { generateToken, hashToken, RESET_TOKEN_TTL_MS } = await import('@/lib/auth/config')
    const raw = generateToken()
    await prisma.passwordResetToken.create({
      data: {
        userId: userAId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })

    const reset = await resetPasswordWithToken(raw, 'NewSecurePass1!')
    expect(reset.ok).toBe(true)

    const after = await prisma.session.count({ where: { userId: userAId } })
    expect(after).toBe(0)

    const { hashPassword } = await import('@/lib/auth/password')
    await prisma.userCredential.update({
      where: { userId: userAId },
      data: { passwordHash: await hashPassword(password) },
    })
    delete process.env.ENABLE_PASSWORD_RESET
  }, 60000)

  it('registration blocked when flag off', async () => {
    const { registerPublicUser } = await import('@/lib/auth/registration')
    delete process.env.ENABLE_PUBLIC_REGISTRATION
    const r = await registerPublicUser({
      email: 'blocked@test.invalid',
      password: 'SecurePass123!',
      acceptedDocumentIds: [],
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('yakında')
  })

  it('authors table unaffected by deletion request', async () => {
    const { prisma } = await import('@/lib/db/prisma')
    const { requestAccountDeletion } = await import('@/lib/auth/account-lifecycle')
    const { ensureUserPanelTestUsers, resolveTestPassword } = await import('@/scripts/db/seed-user-panel-users')

    const authorsBefore = await prisma.author.count()
    const password = resolveTestPassword()
    const { userAId } = await ensureUserPanelTestUsers(password)
    const r = await requestAccountDeletion(userAId, password)
    expect(r.ok).toBe(true)
    const authorsAfter = await prisma.author.count()
    expect(authorsAfter).toBe(authorsBefore)
  }, 60000)

  it('session revoke IDOR rejects other user session', async () => {
    const { prisma } = await import('@/lib/db/prisma')
    const { ensureUserPanelTestUsers, resolveTestPassword } = await import('@/scripts/db/seed-user-panel-users')
    const { createSession } = await import('@/lib/auth/session')
    const { revokeUserSession } = await import('@/lib/auth/session-mgmt')

    const password = resolveTestPassword()
    const { userAId, userBId } = await ensureUserPanelTestUsers(password)
    await createSession(userBId)
    const sessionB = await prisma.session.findFirst({
      where: { userId: userBId },
      orderBy: { createdAt: 'desc' },
    })
    expect(sessionB).not.toBeNull()
    const r = await revokeUserSession(userAId, sessionB!.id)
    expect(r.ok).toBe(false)
  }, 60000)

  it('registration rejects missing legal acceptance', async () => {
    process.env.ENABLE_PUBLIC_REGISTRATION = '1'
    const { registerPublicUser } = await import('@/lib/auth/registration')
    const r = await registerPublicUser({
      email: `legal-missing@${Date.now()}.invalid`,
      password: 'SecurePass123!',
      acceptedDocumentIds: [],
    })
    expect(r.ok).toBe(false)
    delete process.env.ENABLE_PUBLIC_REGISTRATION
  }, 60000)

  it('disabled user cannot reset password', async () => {
    const { prisma } = await import('@/lib/db/prisma')
    const { resetPasswordWithToken } = await import('@/lib/auth/reset-password')
    const { ensureUserPanelTestUsers, resolveTestPassword } = await import('@/scripts/db/seed-user-panel-users')
    const { generateToken, hashToken, RESET_TOKEN_TTL_MS } = await import('@/lib/auth/config')

    const password = resolveTestPassword()
    const { userAId } = await ensureUserPanelTestUsers(password)
    await prisma.user.update({ where: { id: userAId }, data: { status: 'disabled' } })
    const raw = generateToken()
    await prisma.passwordResetToken.create({
      data: {
        userId: userAId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })
    const r = await resetPasswordWithToken(raw, 'AnotherSecure1!')
    expect(r.ok).toBe(false)
    await prisma.user.update({ where: { id: userAId }, data: { status: 'active' } })
  }, 60000)
})
