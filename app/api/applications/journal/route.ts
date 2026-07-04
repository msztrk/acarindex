import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { createJournalApplicationDraft } from '@/lib/journal-applications/service'
import { validateCsrf } from '@/lib/auth/session'

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const created = await createJournalApplicationDraft(sessionOrRes.user.id)
  return NextResponse.json(created)
}
