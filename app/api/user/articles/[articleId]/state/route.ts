import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { isArticleSaved } from '@/lib/user-panel/saved-articles'
import { listReadingLists } from '@/lib/user-panel/reading-lists'

export async function GET(
  _request: Request,
  context: { params: Promise<{ articleId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const { articleId } = await context.params
  const id = parseInt(articleId, 10)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Geçersiz makale' }, { status: 400 })
  }
  const saved = await isArticleSaved(sessionOrRes.user.id, id)
  const lists = await listReadingLists(sessionOrRes.user.id)
  return NextResponse.json({ saved, lists })
}
