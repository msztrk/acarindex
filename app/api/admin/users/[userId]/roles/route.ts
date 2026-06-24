import { NextResponse } from 'next/server'
import { getApiUserManagementSession } from '@/lib/auth/api-guards'
import { assignRoleToUser, removeRoleFromUser } from '@/lib/admin/user-management'
import { validateCsrf } from '@/lib/auth/session'
import { isAppRole } from '@/lib/auth/roles'

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
  const body = (await request.json()) as { roleId?: string }
  if (!body.roleId || !isAppRole(body.roleId)) {
    return NextResponse.json({ error: 'Geçersiz rol' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await assignRoleToUser({
    actorId: session.user.id,
    actorRoles: session.user.roles,
    targetUserId: userId,
    roleId: body.roleId,
    ipAddress: ip,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
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
  const body = (await request.json()) as { roleId?: string }
  if (!body.roleId || !isAppRole(body.roleId)) {
    return NextResponse.json({ error: 'Geçersiz rol' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const result = await removeRoleFromUser({
    actorId: session.user.id,
    actorRoles: session.user.roles,
    targetUserId: userId,
    roleId: body.roleId,
    ipAddress: ip,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
