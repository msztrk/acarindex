import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { createReadingList, listReadingLists } from '@/lib/user-panel/reading-lists'

function clientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
}

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const lists = await listReadingLists(sessionOrRes.user.id)
  return NextResponse.json({ lists })
}

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const body = (await request.json()) as { name?: string }
  if (!body.name) {
    return NextResponse.json({ error: 'name gerekli' }, { status: 400 })
  }
  const result = await createReadingList(sessionOrRes.user.id, body.name, clientIp(request))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, listId: result.listId })
}
