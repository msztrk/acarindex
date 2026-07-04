import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { hasAdminPermission } from '@/lib/auth/authorization'
import {
  cancelContentApplication,
  getContentApplicationDetail,
  updateContentApplicationDraft,
} from '@/lib/applications/service'
import { getPrivateContactForAuthorizedUser } from '@/lib/applications/list-unified'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { id } = await context.params
  const isAdmin = await hasAdminPermission(
    sessionOrRes.user.id,
    'review_content_applications',
    sessionOrRes.user.roles,
  )

  try {
    if (isAdmin) {
      const { prisma } = await import('@/lib/db/prisma')
      const row = await prisma.contentApplication.findUnique({
        where: { id },
        include: {
          events: { orderBy: { createdAt: 'desc' }, take: 50 },
          revisions: { orderBy: { revisionNumber: 'desc' }, take: 20 },
        },
      })
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const privateContact = await getPrivateContactForAuthorizedUser(id, sessionOrRes.user.id, true)
      return NextResponse.json({
        application: row,
        privateContact,
      })
    }

    const row = await getContentApplicationDetail(id, sessionOrRes.user.id)
    const privateContact = await getPrivateContactForAuthorizedUser(
      id,
      sessionOrRes.user.id,
      false,
    )
    return NextResponse.json({ application: row, privateContact })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function PATCH(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params
  let body: { title?: string; draftPayload?: Record<string, unknown> | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  try {
    const row = await updateContentApplicationDraft({
      applicationId: id,
      userId: sessionOrRes.user.id,
      title: body.title,
      draftPayload: body.draftPayload,
    })
    return NextResponse.json({ application: row })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}

export async function DELETE(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params
  try {
    const row = await cancelContentApplication({
      applicationId: id,
      userId: sessionOrRes.user.id,
    })
    return NextResponse.json({ application: row })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Cancel failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
