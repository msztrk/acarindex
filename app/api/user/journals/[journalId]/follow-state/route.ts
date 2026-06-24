import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { isJournalFollowed } from '@/lib/user-panel/follows'

export async function GET(
  _request: Request,
  context: { params: Promise<{ journalId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const { journalId } = await context.params
  const id = parseInt(journalId, 10)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Geçersiz dergi' }, { status: 400 })
  }
  const following = await isJournalFollowed(sessionOrRes.user.id, id)
  return NextResponse.json({ following })
}
