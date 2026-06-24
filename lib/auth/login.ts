import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password'
import { isLoginRateLimited, recordLoginAttempt } from '@/lib/auth/rate-limit'
import {
  buildCsrfCookie,
  buildSessionCookie,
  createCsrfToken,
  createSession,
} from '@/lib/auth/session'
import { loadAuthUserByEmail } from '@/lib/auth/user'

export interface LoginResult {
  ok: boolean
  error?: string
  cookies?: Array<{ name: string; value: string; options: Record<string, unknown> }>
}

export async function loginWithPassword(
  email: string,
  password: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<LoginResult> {
  const normalized = email.toLowerCase().trim()
  if (!normalized || !password) {
    return { ok: false, error: 'E-posta ve parola gerekli.' }
  }

  if (await isLoginRateLimited(normalized, meta?.ipAddress)) {
    return { ok: false, error: 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.' }
  }

  const credential = await prisma.userCredential.findFirst({
    where: { user: { email: normalized } },
    include: { user: true },
  })

  if (!credential) {
    await recordLoginAttempt(normalized, false, meta?.ipAddress)
    return { ok: false, error: 'Geçersiz e-posta veya parola.' }
  }

  if (credential.user.status !== 'active') {
    await recordLoginAttempt(normalized, false, meta?.ipAddress)
    return { ok: false, error: 'Hesap pasif veya askıda.' }
  }

  const valid = await verifyPassword(password, credential.passwordHash)
  if (!valid) {
    await recordLoginAttempt(normalized, false, meta?.ipAddress)
    return { ok: false, error: 'Geçersiz e-posta veya parola.' }
  }

  await recordLoginAttempt(normalized, true, meta?.ipAddress)

  const token = await createSession(credential.userId, meta)
  const csrf = createCsrfToken()

  await writeAuditLog({
    actorId: credential.userId,
    action: 'auth.login',
    resource: 'user',
    resourceId: credential.userId,
    ipAddress: meta?.ipAddress,
  })

  return {
    ok: true,
    cookies: [buildSessionCookie(token), buildCsrfCookie(csrf)],
  }
}

export async function registerUser(input: {
  email: string
  password: string
  name?: string
  roleIds?: string[]
  actorId?: string
  ipAddress?: string
}): Promise<{ ok: boolean; error?: string; userId?: string }> {
  const normalized = input.email.toLowerCase().trim()
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
      credential: { create: { passwordHash: hash } },
      roles: {
        create: (input.roleIds ?? ['USER']).map((roleId) => ({
          roleId,
          grantedBy: input.actorId ?? null,
        })),
      },
    },
  })

  await writeAuditLog({
    actorId: input.actorId ?? user.id,
    action: 'user.create',
    resource: 'user',
    resourceId: user.id,
    ipAddress: input.ipAddress,
  })

  return { ok: true, userId: user.id }
}

export async function getUserForLogin(email: string) {
  return loadAuthUserByEmail(email)
}
