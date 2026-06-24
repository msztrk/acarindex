import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { changeUserPassword } from '@/lib/auth/change-password'
import { getApiSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionOrRes = await getApiSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const session = sessionOrRes

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF doğrulaması başarısız' }, { status: 403 })
  }

  const body = (await request.json()) as {
    currentPassword?: string
    newPassword?: string
    revokeOtherSessions?: boolean
  }

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: 'Mevcut ve yeni parola gerekli.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await changeUserPassword({
    userId: session.user.id,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    sessionId: session.sessionId,
    revokeOtherSessions: body.revokeOtherSessions ?? true,
    ipAddress: ip,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    revokedSessions: result.revokedSessions ?? 0,
  })
}
