import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  deleteReadingList,
  getReadingListDetail,
  updateReadingList,
} from '@/lib/user-panel/reading-lists'

function clientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const { listId } = await context.params
  const list = await getReadingListDetail(sessionOrRes.user.id, listId)
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(list)
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const { listId } = await context.params
  const body = (await request.json()) as { name?: string }
  if (!body.name) {
    return NextResponse.json({ error: 'name gerekli' }, { status: 400 })
  }
  const result = await updateReadingList(
    sessionOrRes.user.id,
    listId,
    body.name,
    clientIp(request),
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const { listId } = await context.params
  const result = await deleteReadingList(sessionOrRes.user.id, listId, clientIp(request))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json({ ok: true })
}
