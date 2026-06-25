import { NextResponse } from 'next/server'
import { getApiAdminSession } from '@/lib/auth/api-guards'
import { canManageRole } from '@/lib/auth/roles'
import { validateCsrf } from '@/lib/auth/session'
import { adminVerifyUserEmail } from '@/lib/auth/account-lifecycle'

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  if (!canManageRole(sessionOrRes.user.roles, 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { userId } = await context.params
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const result = await adminVerifyUserEmail(userId, sessionOrRes.user.id, { ipAddress: ip })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
