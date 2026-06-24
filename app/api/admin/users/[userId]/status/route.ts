import { NextResponse } from 'next/server'
import { getApiUserManagementSession } from '@/lib/auth/api-guards'
import { setUserStatus } from '@/lib/admin/user-management'
import { validateCsrf } from '@/lib/auth/session'

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const sessionOrRes = await getApiUserManagementSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const session = sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { userId } = await context.params
  const body = (await request.json()) as { status?: string }
  if (body.status !== 'active' && body.status !== 'disabled') {
    return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await setUserStatus({
    actorId: session.user.id,
    targetUserId: userId,
    status: body.status,
    ipAddress: ip,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
