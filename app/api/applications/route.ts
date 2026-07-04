import { NextResponse } from 'next/server'
import type { ContentApplicationKind } from '@prisma/client'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { listUnifiedUserApplications } from '@/lib/applications/list-unified'
import { createContentApplicationDraft } from '@/lib/applications/service'
import { validateCsrf } from '@/lib/auth/session'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const items = await listUnifiedUserApplications(sessionOrRes.user.id)
  return NextResponse.json({ applications: items })
}

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  let body: { kind?: ContentApplicationKind; title?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  const kind = body.kind
  if (kind !== 'new_journal' && kind !== 'announcement' && kind !== 'data_correction') {
    return NextResponse.json({ error: 'Geçersiz başvuru türü.' }, { status: 400 })
  }

  const row = await createContentApplicationDraft({
    userId: sessionOrRes.user.id,
    kind,
    title: body.title,
  })

  return NextResponse.json({ application: row })
}
