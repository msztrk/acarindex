import { NextResponse } from 'next/server'
import { getApiAdminPermissionSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  getJournalApplicationForAdmin,
  reviewJournalApplication,
  type AdminJournalReviewAction,
} from '@/lib/journal-applications/admin-service'

type RouteCtx = { params: Promise<{ id: string }> }

const ACTIONS: AdminJournalReviewAction[] = [
  'precheck',
  'under_review',
  'request_revision',
  'reject',
  'approve',
]

export async function GET(_request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiAdminPermissionSession('review_content_applications')
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { id } = await context.params
  try {
    const detail = await getJournalApplicationForAdmin(id)
    return NextResponse.json({ application: detail })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Not found'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiAdminPermissionSession('review_content_applications')
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params

  let body: {
    action?: AdminJournalReviewAction
    note?: string
    assignedTo?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  if (!body.action || !ACTIONS.includes(body.action)) {
    return NextResponse.json({ error: 'Geçerli action gerekli.' }, { status: 400 })
  }

  try {
    const application = await reviewJournalApplication({
      contentApplicationId: id,
      reviewerId: sessionOrRes.user.id,
      action: body.action,
      note: body.note,
      assignedTo: body.assignedTo,
    })
    return NextResponse.json({ application })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'İşlem başarısız.'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
