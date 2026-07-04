import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { submitJournalApplication } from '@/lib/journal-applications/service'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'

type RouteCtx = { params: Promise<{ contentApplicationId: string }> }

export async function POST(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { contentApplicationId } = await context.params
  try {
    const result = await submitJournalApplication(contentApplicationId, sessionOrRes.user.id)
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 422 })
    }
    return NextResponse.json({ application: result.application })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Submit failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
