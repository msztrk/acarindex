import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  generateToken,
  hashToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  cookieSecure,
} from '@/lib/auth/config'
import { loadAuthUserById, type AuthUser } from '@/lib/auth/user'

export interface SessionPayload {
  user: AuthUser
  sessionId: string
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  })

  return token
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined)
}

export async function destroySessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined)
}

export async function revokeOtherSessions(userId: string, keepSessionId?: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
  })
  return result.count
}

export async function getSessionFromToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }
  if (session.user.status !== 'active') return null

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined)

  const user = await loadAuthUserById(session.userId)
  if (!user) return null

  return { user, sessionId: session.id }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return getSessionFromToken(token)
}

export function buildSessionCookie(token: string): {
  name: string
  value: string
  options: {
    httpOnly: boolean
    secure: boolean
    sameSite: 'lax'
    path: string
    maxAge: number
  }
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    },
  }
}

export function buildClearSessionCookie(): {
  name: string
  value: string
  options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number }
} {
  return {
    name: SESSION_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  }
}

export function createCsrfToken(): string {
  return generateToken(24)
}

export function buildCsrfCookie(token: string): {
  name: string
  value: string
  options: {
    httpOnly: boolean
    secure: boolean
    sameSite: 'lax'
    path: string
    maxAge: number
  }
} {
  return {
    name: CSRF_COOKIE,
    value: token,
    options: {
      httpOnly: false,
      secure: cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    },
  }
}

export function buildClearCsrfCookie(): {
  name: string
  value: string
  options: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge: number }
} {
  return {
    name: CSRF_COOKIE,
    value: '',
    options: {
      httpOnly: false,
      secure: cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  }
}

export async function validateCsrf(request: Request): Promise<boolean> {
  const header = request.headers.get(CSRF_HEADER)
  const cookieStore = await cookies()
  const cookie = cookieStore.get(CSRF_COOKIE)?.value
  if (!header || !cookie) return false
  return header === cookie
}
