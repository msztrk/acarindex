import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import {
  buildClearCsrfCookie,
  buildClearSessionCookie,
  destroySessionByToken,
  getServerSession,
  validateCsrf,
} from '@/lib/auth/session'
import { writeAuditLog } from '@/lib/auth/audit'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/auth/config'

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Auth disabled' }, { status: 404 })
  }

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF doğrulaması başarısız' }, { status: 403 })
  }

  const session = await getServerSession()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await destroySessionByToken(token)
  }

  if (session) {
    await writeAuditLog({
      actorId: session.user.id,
      action: 'auth.logout',
      resource: 'user',
      resourceId: session.user.id,
    })
  }

  const response = NextResponse.json({ ok: true })
  const clearSession = buildClearSessionCookie()
  const clearCsrf = buildClearCsrfCookie()
  response.cookies.set(clearSession.name, clearSession.value, clearSession.options)
  response.cookies.set(clearCsrf.name, clearCsrf.value, clearCsrf.options)
  return response
}
