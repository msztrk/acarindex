import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  addArticleToList,
  removeArticleFromList,
  reorderListItems,
} from '@/lib/user-panel/reading-lists'

function clientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
}

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const { listId } = await context.params
  const body = (await request.json()) as { articleId?: number }
  if (!body.articleId) {
    return NextResponse.json({ error: 'articleId gerekli' }, { status: 400 })
  }
  const result = await addArticleToList(
    sessionOrRes.user.id,
    listId,
    body.articleId,
    clientIp(request),
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const { listId } = await context.params
  const body = (await request.json()) as { articleId?: number }
  if (!body.articleId) {
    return NextResponse.json({ error: 'articleId gerekli' }, { status: 400 })
  }
  const result = await removeArticleFromList(
    sessionOrRes.user.id,
    listId,
    body.articleId,
    clientIp(request),
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const { listId } = await context.params
  const body = (await request.json()) as { itemIds?: string[] }
  if (!body.itemIds || !Array.isArray(body.itemIds)) {
    return NextResponse.json({ error: 'itemIds gerekli' }, { status: 400 })
  }
  const result = await reorderListItems(
    sessionOrRes.user.id,
    listId,
    body.itemIds,
    clientIp(request),
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
