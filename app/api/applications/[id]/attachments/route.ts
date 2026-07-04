import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'
import {
  listAttachmentsForApplication,
  uploadAttachment,
} from '@/lib/applications/attachments'
import { AttachmentValidationError, isJournalUploadKind } from '@/lib/applications/storage/file-validation'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { id } = await context.params
  try {
    const attachments = await listAttachmentsForApplication(id, sessionOrRes.user.id)
    return NextResponse.json({ attachments })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function POST(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { id } = await context.params
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const kindRaw = String(formData.get('kind') ?? '')
  if (!isJournalUploadKind(kindRaw)) {
    return NextResponse.json({ error: 'Geçersiz dosya türü.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya gerekli.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const attachment = await uploadAttachment({
      applicationId: id,
      userId: sessionOrRes.user.id,
      kind: kindRaw,
      file: {
        buffer,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      },
    })
    return NextResponse.json({ attachment }, { status: 201 })
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof AttachmentValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
