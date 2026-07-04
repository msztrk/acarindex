import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'
import { deleteAttachment } from '@/lib/applications/attachments'

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> }

export async function DELETE(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id, attachmentId } = await context.params
  try {
    await deleteAttachment({
      applicationId: id,
      attachmentId,
      userId: sessionOrRes.user.id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
