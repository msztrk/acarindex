import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  followJournal,
  listFollowedJournals,
  unfollowJournal,
} from '@/lib/user-panel/follows'

function clientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
}

export async function GET(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const url = new URL(request.url)
  const sp: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { sp[k] = v })
  const data = await listFollowedJournals(sessionOrRes.user.id, sp)
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const body = (await request.json()) as { journalId?: number }
  if (!body.journalId) {
    return NextResponse.json({ error: 'journalId gerekli' }, { status: 400 })
  }
  const result = await followJournal(sessionOrRes.user.id, body.journalId, clientIp(request))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const body = (await request.json()) as { journalId?: number }
  if (!body.journalId) {
    return NextResponse.json({ error: 'journalId gerekli' }, { status: 400 })
  }
  await unfollowJournal(sessionOrRes.user.id, body.journalId, clientIp(request))
  return NextResponse.json({ ok: true })
}
