import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { isForbiddenError } from '@/lib/auth/forbidden'
import { getAttachmentDownloadUrl } from '@/lib/applications/attachments'

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { id, attachmentId } = await context.params
  try {
    const download = await getAttachmentDownloadUrl({
      applicationId: id,
      attachmentId,
      userId: sessionOrRes.user.id,
      userRoles: sessionOrRes.user.roles,
    })
    return NextResponse.redirect(download.url, { status: 302 })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}
