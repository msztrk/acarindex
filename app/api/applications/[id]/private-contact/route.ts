import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { upsertPrivateContact } from '@/lib/applications/list-unified'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { id } = await context.params
  const { getPrivateContactForAuthorizedUser } = await import('@/lib/applications/list-unified')
  const { hasAdminPermission } = await import('@/lib/auth/authorization')

  const isAdmin = await hasAdminPermission(
    sessionOrRes.user.id,
    'review_content_applications',
    sessionOrRes.user.roles,
  )

  try {
    const contact = await getPrivateContactForAuthorizedUser(
      id,
      sessionOrRes.user.id,
      isAdmin,
    )
    if (!contact) return NextResponse.json({ privateContact: null })
    return NextResponse.json({ privateContact: contact })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function PUT(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params
  let body: Record<string, string | null | undefined>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  try {
    const row = await upsertPrivateContact({
      applicationId: id,
      userId: sessionOrRes.user.id,
      data: {
        contactName: body.contactName ?? null,
        contactRole: body.contactRole ?? null,
        contactEmail: body.contactEmail ?? null,
        workPhone: body.workPhone ?? null,
        mobilePhone: body.mobilePhone ?? null,
      },
    })
    return NextResponse.json({ privateContact: row })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
