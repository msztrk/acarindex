import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { submitContentApplication } from '@/lib/applications/service'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params
  try {
    const row = await submitContentApplication({
      applicationId: id,
      userId: sessionOrRes.user.id,
    })
    return NextResponse.json({ application: row })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Submit failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
