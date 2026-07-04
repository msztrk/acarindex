import { NextResponse } from 'next/server'
import { getApiAdminPermissionSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { publishDraftJournal } from '@/lib/admin/journal-publish'

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiAdminPermissionSession('manage_journals')
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params
  let journalId: bigint
  try {
    journalId = BigInt(id)
  } catch {
    return NextResponse.json({ error: 'Geçersiz dergi kimliği.' }, { status: 400 })
  }

  try {
    const result = await publishDraftJournal(journalId, sessionOrRes.user.id)
    return NextResponse.json({ journal: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İşlem başarısız.'
    const status = message.includes('not found') ? 404 : 409
    return NextResponse.json({ error: message }, { status })
  }
}
