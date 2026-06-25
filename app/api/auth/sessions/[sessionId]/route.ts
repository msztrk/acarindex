import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { revokeUserSession } from '@/lib/auth/session-mgmt'
import { writeAuditLog } from '@/lib/auth/audit'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { sessionId } = await context.params
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined

  const result = await revokeUserSession(
    sessionOrRes.user.id,
    sessionId,
    sessionOrRes.sessionId,
  )

  if (!result.ok) {
    const status = result.error?.includes('bulunamadı') ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  await writeAuditLog({
    actorId: sessionOrRes.user.id,
    action: 'auth.sessions.revoke_one',
    resource: 'session',
    resourceId: sessionId,
    ipAddress: ip,
  })

  return NextResponse.json({ ok: true })
}
