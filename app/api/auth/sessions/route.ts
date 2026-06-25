import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  listUserSessions,
  revokeAllSessionsForUser,
} from '@/lib/auth/session-mgmt'
import { writeAuditLog } from '@/lib/auth/audit'

export async function GET() {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const sessions = await listUserSessions(sessionOrRes.user.id, sessionOrRes.sessionId)
  return NextResponse.json({ sessions })
}

export async function DELETE(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const count = await revokeAllSessionsForUser(sessionOrRes.user.id, sessionOrRes.sessionId)

  await writeAuditLog({
    actorId: sessionOrRes.user.id,
    action: 'auth.sessions.revoke_all',
    resource: 'user',
    resourceId: sessionOrRes.user.id,
    metadata: { count },
    ipAddress: ip,
  })

  return NextResponse.json({ ok: true, revoked: count })
}
