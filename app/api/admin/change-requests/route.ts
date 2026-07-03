import { NextResponse } from 'next/server'
import { getApiAdminPermissionSession } from '@/lib/auth/api-guards'
import { reviewChangeRequest } from '@/lib/change-requests/service'
import { validateCsrf } from '@/lib/auth/session'

export async function PATCH(request: Request) {
  const sessionOrRes = await getApiAdminPermissionSession('review_change_requests')
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  let body: { id?: string; status?: 'approved' | 'rejected'; reviewNote?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  if (!body.id || (body.status !== 'approved' && body.status !== 'rejected')) {
    return NextResponse.json({ error: 'id ve status gerekli.' }, { status: 400 })
  }

  try {
    const row = await reviewChangeRequest({
      id: body.id,
      reviewerId: sessionOrRes.user.id,
      status: body.status,
      reviewNote: body.reviewNote,
    })
    return NextResponse.json({ changeRequest: row })
  } catch {
    return NextResponse.json({ error: 'Talep incelenemedi.' }, { status: 403 })
  }
}
