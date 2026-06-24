import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { isRecentEntityType } from '@/lib/user-panel/config'
import { clearRecentViews, listRecentViews, recordRecentView } from '@/lib/user-panel/recent-views'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const rows = await listRecentViews(sessionOrRes.user.id)
  return NextResponse.json({ rows })
}

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const body = (await request.json()) as { entityType?: string; entityId?: number }
  if (!body.entityType || !isRecentEntityType(body.entityType) || !body.entityId) {
    return NextResponse.json({ error: 'Geçersiz entity' }, { status: 400 })
  }
  await recordRecentView(sessionOrRes.user.id, body.entityType, body.entityId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  await clearRecentViews(sessionOrRes.user.id)
  return NextResponse.json({ ok: true })
}
