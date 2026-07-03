import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { createChangeRequest, listChangeRequestsForUser } from '@/lib/change-requests/service'
import { isCriticalChangeType } from '@/lib/auth/change-policy'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const rows = await listChangeRequestsForUser(sessionOrRes.user.id)
  return NextResponse.json({ changeRequests: rows })
}

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  let body: {
    entityType?: string
    entityId?: string
    changeType?: string
    oldData?: Record<string, unknown>
    newData?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  const { entityType, entityId, changeType } = body
  if (!entityType || !entityId || !changeType) {
    return NextResponse.json({ error: 'entityType, entityId ve changeType gerekli.' }, { status: 400 })
  }

  if (!isCriticalChangeType(changeType)) {
    return NextResponse.json({ error: 'Kritik olmayan değişiklik türü.' }, { status: 400 })
  }

  try {
    const row = await createChangeRequest({
      entityType,
      entityId,
      requestedBy: sessionOrRes.user.id,
      changeType,
      oldData: body.oldData ?? null,
      newData: body.newData ?? null,
    })
    return NextResponse.json({ changeRequest: row })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Talep oluşturulamadı.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
